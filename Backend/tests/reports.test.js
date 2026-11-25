const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../app");

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
  const response = await request(app).post("/api/auth/register").send({
    name,
    email: `${name.toLowerCase().replace(/\s/g, "")}@example.com`,
    password: "Password1"
  });
  return response.body.data.token;
}

async function createInterview(token) {
  const created = await request(app)
    .post("/api/interviews")
    .set("Authorization", `Bearer ${token}`)
    .send({
      duration: 5,
      questionCount: 5,
      category: "technical",
      difficulty: "medium",
      language: "en",
      jobRole: "Software Engineer"
    });
  const interview = created.body.data;
  await request(app)
    .post(`/api/interviews/${interview.id}/start`)
    .set("Authorization", `Bearer ${token}`);
  await request(app)
    .post("/api/answers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      interviewId: interview.id,
      questionId: interview.questions[0].questionId,
      answerText: "I validated input, used authentication, added tests, and monitored the result.",
      status: "answered"
    });
  await request(app)
    .post(`/api/interviews/${interview.id}/complete`)
    .set("Authorization", `Bearer ${token}`);
  return interview.id;
}

describe("Phase 7 reports and dashboard", () => {
  test("brand-new dashboard and progress return zero states", async () => {
    const token = await register("New Dashboard");

    const stats = await request(app).get("/api/dashboard/stats").set("Authorization", `Bearer ${token}`);
    expect(stats.status).toBe(200);
    expect(stats.body.data.completedInterviews).toBe(0);
    expect(stats.body.data.averageScore).toBe(0);

    const recommendations = await request(app).get("/api/dashboard/recommendations").set("Authorization", `Bearer ${token}`);
    expect(recommendations.status).toBe(200);
    expect(recommendations.body.data.length).toBe(3);

    const progress = await request(app).get("/api/reports/progress?period=week").set("Authorization", `Bearer ${token}`);
    expect(progress.status).toBe(200);
    expect(progress.body.data.data).toHaveLength(8);
    expect(progress.body.data.data.every((item) => item.averageScore === 0)).toBe(true);
  });

  test("evaluation creates report, report detail is owner-isolated, and PDF downloads", async () => {
    const token = await register("Report Owner");
    const interviewId = await createInterview(token);

    const evaluated = await request(app)
      .post(`/api/interviews/${interviewId}/evaluate`)
      .set("Authorization", `Bearer ${token}`);
    expect(evaluated.status).toBe(200);

    const list = await request(app).get("/api/reports").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const reportId = list.body.data[0].id;
    const detail = await request(app).get(`/api/reports/${reportId}`).set("Authorization", `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.questionResults.length).toBeGreaterThan(0);

    const otherToken = await register("Other Viewer");
    const isolated = await request(app).get(`/api/reports/${reportId}`).set("Authorization", `Bearer ${otherToken}`);
    expect(isolated.status).toBe(404);

    const pdf = await request(app).get(`/api/reports/${reportId}/download`).set("Authorization", `Bearer ${token}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.body.length).toBeGreaterThan(100);
  });

  test("dashboard activity and skills match completed report data", async () => {
    const token = await register("Analytics User");
    await createInterview(token);

    const stats = await request(app).get("/api/dashboard/stats").set("Authorization", `Bearer ${token}`);
    expect(stats.body.data.completedInterviews).toBe(1);
    expect(stats.body.data.reportsGenerated).toBe(1);

    const activity = await request(app).get("/api/dashboard/activity?limit=5").set("Authorization", `Bearer ${token}`);
    expect(activity.body.data).toHaveLength(1);

    const skills = await request(app).get("/api/dashboard/skills").set("Authorization", `Bearer ${token}`);
    expect(Array.isArray(skills.body.data.strong)).toBe(true);
    expect(Array.isArray(skills.body.data.weak)).toBe(true);
  });
});
