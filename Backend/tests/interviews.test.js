const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../app");
const User = require("../models/User");
const Question = require("../models/Question");
const Interview = require("../models/Interview");

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

async function register(name) {
  const email = `${name.toLowerCase().replace(/\s/g, "")}@example.com`;
  const response = await request(app).post("/api/auth/register").send({
    name,
    email,
    password: "Password1"
  });
  return { token: response.body.data.token, user: response.body.data.user };
}

async function createBankQuestion() {
  return Question.create({
    text: "Explain how REST authentication should protect an API.",
    category: "technical",
    jobRole: "Software Engineer",
    skill: "Node.js",
    difficulty: "medium",
    language: "en",
    expectedAnswer: "Use secure tokens, validation, TLS, and authorization checks.",
    keywords: ["token", "TLS", "authorization", "validation"],
    tags: ["rest", "security"],
    evaluationCriteria: ["Security", "Structure"],
    timeLimitSeconds: 180,
    source: "seed",
    isActive: true,
    seedKey: "phase4-auth"
  });
}

async function createInterview(token, overrides = {}) {
  return request(app)
    .post("/api/interviews")
    .set("Authorization", `Bearer ${token}`)
    .send({
      duration: 10,
      questionCount: 5,
      category: "technical",
      difficulty: "medium",
      language: "en",
      mode: "practice",
      style: "standard",
      clientId: "offline-client-1",
      ...overrides
    });
}

describe("Phase 4 interview lifecycle", () => {
  test("create validates setup and idempotently returns clientId record", async () => {
    await createBankQuestion();
    const { token } = await register("Interview One");

    const invalid = await request(app)
      .post("/api/interviews")
      .set("Authorization", `Bearer ${token}`)
      .send({ duration: 3, questionCount: 99, category: "unknown" });
    expect(invalid.status).toBe(400);

    const first = await createInterview(token);
    expect(first.status).toBe(201);
    expect(first.body.data.status).toBe("draft");

    const second = await createInterview(token);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  test("list and get are owner-only", async () => {
    await createBankQuestion();
    const owner = await register("Owner User");
    const other = await register("Other User");
    const created = await createInterview(owner.token);

    const list = await request(app)
      .get("/api/interviews")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const forbidden = await request(app)
      .get(`/api/interviews/${created.body.data.id}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(forbidden.status).toBe(404);
  });

  test("happy state flow, autosave, pause, resume, and complete twice", async () => {
    await createBankQuestion();
    const { token } = await register("Flow User");
    const created = await createInterview(token);
    const id = created.body.data.id;

    const autosave = await request(app)
      .put(`/api/interviews/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ currentIndex: 2, elapsedSeconds: 45 });
    expect(autosave.status).toBe(200);
    expect(autosave.body.data.currentIndex).toBe(2);

    const started = await request(app)
      .post(`/api/interviews/${id}/start`)
      .set("Authorization", `Bearer ${token}`);
    expect(started.status).toBe(200);
    expect(started.body.data.status).toBe("in_progress");

    const paused = await request(app)
      .post(`/api/interviews/${id}/pause`)
      .set("Authorization", `Bearer ${token}`)
      .send({ elapsedSeconds: 90 });
    expect(paused.status).toBe(200);
    expect(paused.body.data.status).toBe("paused");

    const resumed = await request(app)
      .post(`/api/interviews/${id}/resume`)
      .set("Authorization", `Bearer ${token}`);
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.status).toBe("in_progress");

    const completed = await request(app)
      .post(`/api/interviews/${id}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe("completed");

    const again = await request(app)
      .post(`/api/interviews/${id}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(again.status).toBe(200);
    expect(again.body.data.status).toBe("completed");
  });

  test("invalid transitions return 400 and completed cannot be started or autosaved", async () => {
    await createBankQuestion();
    const { token } = await register("Invalid Flow");
    const created = await createInterview(token);
    const id = created.body.data.id;

    const pauseDraft = await request(app)
      .post(`/api/interviews/${id}/pause`)
      .set("Authorization", `Bearer ${token}`);
    expect(pauseDraft.status).toBe(400);

    await request(app).post(`/api/interviews/${id}/start`).set("Authorization", `Bearer ${token}`);
    await request(app).post(`/api/interviews/${id}/complete`).set("Authorization", `Bearer ${token}`);

    const startComplete = await request(app)
      .post(`/api/interviews/${id}/start`)
      .set("Authorization", `Bearer ${token}`);
    expect(startComplete.status).toBe(400);

    const pauseComplete = await request(app)
      .post(`/api/interviews/${id}/pause`)
      .set("Authorization", `Bearer ${token}`);
    expect(pauseComplete.status).toBe(400);

    const autosaveComplete = await request(app)
      .put(`/api/interviews/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ elapsedSeconds: 20 });
    expect(autosaveComplete.status).toBe(400);
  });

  test("snapshot remains frozen after editing the question bank", async () => {
    const bankQuestion = await createBankQuestion();
    const { token } = await register("Snapshot User");
    const created = await createInterview(token);
    const snapshotText = created.body.data.questions[0].text;

    await Question.findByIdAndUpdate(bankQuestion.id, { text: "This bank question was changed." });

    const fetched = await request(app)
      .get(`/api/interviews/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(fetched.body.data.questions[0].text).toBe(snapshotText);
  });

  test("delete removes the interview and owner only cascade", async () => {
    await createBankQuestion();
    const { token } = await register("Delete User");
    const created = await createInterview(token);

    const deleted = await request(app)
      .delete(`/api/interviews/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleted.status).toBe(200);
    expect(await Interview.countDocuments()).toBe(0);
  });

  test("rapid-fire shortens snapshot time limits", async () => {
    await createBankQuestion();
    const { token } = await register("Rapid User");
    const created = await createInterview(token, { style: "rapid-fire", clientId: "rapid-client" });

    expect(created.body.data.questions.length).toBeGreaterThan(0);
    expect(created.body.data.questions.every((item) => item.timeLimitSeconds <= 90)).toBe(true);
  });
});
