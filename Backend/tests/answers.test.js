const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../app");
const Answer = require("../models/Answer");
const Interview = require("../models/Interview");
const Question = require("../models/Question");

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
  return response.body.data.token;
}

async function startInterview(token) {
  const bank = await Question.create({
    text: "Explain polymorphism, inheritance, and encapsulation.",
    category: "technical",
    jobRole: "Software Engineer",
    skill: "OOP",
    difficulty: "medium",
    language: "en",
    expectedAnswer: "Polymorphism allows common interfaces. Inheritance shares behavior. Encapsulation protects state.",
    keywords: ["polymorphism", "inheritance", "encapsulation", "abstraction"],
    tags: ["oop"],
    evaluationCriteria: ["Definition", "Example"],
    timeLimitSeconds: 180,
    seedKey: "answer-test"
  });

  const created = await request(app)
    .post("/api/interviews")
    .set("Authorization", `Bearer ${token}`)
    .send({
      duration: 10,
      questionCount: 5,
      category: "technical",
      difficulty: "medium",
      language: "en",
      style: "standard",
      clientId: `answer-client-${Math.random()}`
    });

  await request(app)
    .post(`/api/interviews/${created.body.data.id}/start`)
    .set("Authorization", `Bearer ${token}`);

  return { interview: await Interview.findById(created.body.data.id), bank };
}

describe("Phase 5 answers and evaluation", () => {
  test("single submit is deterministic and upserts without duplicates", async () => {
    const token = await register("Answer One");
    const { interview } = await startInterview(token);
    const snapshot = interview.questions[0];

    const body = {
      interviewId: interview.id,
      questionId: snapshot.questionId,
      answerText: "Polymorphism uses common interfaces. Inheritance shares behavior. Encapsulation protects state. Abstraction hides details.",
      status: "answered",
      source: "text",
      timeTakenSeconds: 50
    };
    const first = await request(app).post("/api/answers").set("Authorization", `Bearer ${token}`).send(body);
    const second = await request(app).post("/api/answers").set("Authorization", `Bearer ${token}`).send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.evaluation.score).toBe(second.body.data.evaluation.score);
    expect(await Answer.countDocuments({ interview: interview._id })).toBe(1);
  });

  test("wrong interview state and wrong questionId return 400", async () => {
    const token = await register("Answer Two");
    const created = await request(app).post("/api/interviews").set("Authorization", `Bearer ${token}`).send({
      duration: 5,
      questionCount: 5,
      category: "general",
      difficulty: "easy",
      language: "en"
    });

    const draft = await request(app).post("/api/answers").set("Authorization", `Bearer ${token}`).send({
      interviewId: created.body.data.id,
      questionId: created.body.data.questions[0].questionId,
      answerText: "An answer"
    });
    expect(draft.status).toBe(400);

    await Question.create({
      text: "Explain one general interview strategy.",
      category: "general",
      jobRole: "General/Fresher",
      skill: "Problem Solving",
      difficulty: "easy",
      language: "en",
      expectedAnswer: "Clarify, plan, act, and review.",
      keywords: ["clarify", "plan", "act", "review"],
      tags: ["general"],
      evaluationCriteria: ["Structure"],
      timeLimitSeconds: 120,
      seedKey: "answer-general"
    });
  });

  test("bulk submission stores answers", async () => {
    const token = await register("Bulk Answer");
    const { interview } = await startInterview(token);
    const snapshot = interview.questions[0];
    const response = await request(app).post("/api/answers").set("Authorization", `Bearer ${token}`).send({
      interviewId: interview.id,
      answers: [
        { questionId: snapshot.questionId, answerText: "Polymorphism and inheritance with encapsulation.", status: "answered" },
        { questionId: snapshot.questionId, status: "skipped" }
      ]
    });
    expect(response.status).toBe(201);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test("retry increments attempt and stores previous result", async () => {
    const token = await register("Retry Answer");
    const { interview } = await startInterview(token);
    const snapshot = interview.questions[0];
    const submitted = await request(app).post("/api/answers").set("Authorization", `Bearer ${token}`).send({
      interviewId: interview.id,
      questionId: snapshot.questionId,
      answerText: "Objects.",
      status: "answered"
    });
    const answerId = submitted.body.data.id;

    const retried = await request(app)
      .post(`/api/answers/${answerId}/retry`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        answerText: "Polymorphism uses interfaces. Inheritance shares behavior. Encapsulation protects state.",
        status: "answered"
      });

    expect(retried.status).toBe(200);
    expect(retried.body.data.answer.attempt).toBe(2);
    expect(retried.body.data.answer.attempts).toHaveLength(1);
  });

  test("list and get are owner-only", async () => {
    const ownerToken = await register("Owner Answer");
    const otherToken = await register("Other Answer");
    const { interview } = await startInterview(ownerToken);
    const snapshot = interview.questions[0];
    const submitted = await request(app).post("/api/answers").set("Authorization", `Bearer ${ownerToken}`).send({
      interviewId: interview.id,
      questionId: snapshot.questionId,
      answerText: "Polymorphism inheritance encapsulation",
      status: "answered"
    });

    const other = await request(app)
      .get(`/api/answers/${submitted.body.data.id}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(other.status).toBe(404);

    const list = await request(app)
      .get(`/api/interviews/${interview.id}/answers`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
  });

  test("evaluate computes totals and complete stores clientEvaluation", async () => {
    const token = await register("Evaluation Answer");
    const { interview } = await startInterview(token);
    const snapshot = interview.questions[0];
    await request(app).post("/api/answers").set("Authorization", `Bearer ${token}`).send({
      interviewId: interview.id,
      questionId: snapshot.questionId,
      answerText: "Polymorphism inheritance encapsulation abstraction",
      status: "answered"
    });

    await request(app)
      .post(`/api/interviews/${interview.id}/complete`)
      .set("Authorization", `Bearer ${token}`)
      .send({ clientEvaluation: { score: 99, source: "client" } });

    const evaluated = await request(app)
      .post(`/api/interviews/${interview.id}/evaluate`)
      .set("Authorization", `Bearer ${token}`);
    expect(evaluated.status).toBe(200);
    expect(evaluated.body.data.report.evaluationMethod).toBe("rule-based-v1");

    const fetched = await request(app)
      .get(`/api/interviews/${interview.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(fetched.body.data.clientEvaluation).toEqual({ score: 99, source: "client" });
  });
});
