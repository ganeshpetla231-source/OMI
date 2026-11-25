const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "e2e-test-secret";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/talkready-e2e";
const app = require("../app");
const { seedData } = require("../seeders/index");

async function run() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await seedData();

  const register = await request(app).post("/api/auth/register").send({
    name: "E2E User",
    email: "e2e@example.com",
    password: "Password1"
  });
  if (register.status !== 201) throw new Error(`register failed: ${register.status}`);
  const token = register.body.data.token;

  await request(app).get("/api/profile").set("Authorization", `Bearer ${token}`).expect(200);
  await request(app).put("/api/profile").set("Authorization", `Bearer ${token}`).send({
    careerGoal: "Backend engineer",
    skills: ["Node.js", "JavaScript"]
  }).expect(200);

  const generate = await request(app).post("/api/questions/generate")
    .set("Authorization", `Bearer ${token}`)
    .send({ count: 5, category: "technical", difficulty: "medium", language: "en" });
  if (generate.status !== 200) throw new Error(`generate failed: ${generate.status}`);

  const created = await request(app).post("/api/interviews")
    .set("Authorization", `Bearer ${token}`)
    .send({ duration: 5, questionCount: 5, category: "technical", difficulty: "medium", language: "en", jobRole: "Software Engineer" });
  if (created.status !== 201) throw new Error(`interview create failed: ${created.status}`);
  const interview = created.body.data;

  await request(app).post(`/api/interviews/${interview.id}/start`)
    .set("Authorization", `Bearer ${token}`).expect(200);
  await request(app).post("/api/answers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      interviewId: interview.id,
      answers: interview.questions.map((question) => ({
        questionId: question.questionId,
        answerText: "I identified the problem, used Node.js and JavaScript, validated the result, and described the outcome.",
        status: "answered"
      }))
    }).expect(201);

  await request(app).post(`/api/interviews/${interview.id}/complete`)
    .set("Authorization", `Bearer ${token}`).expect(200);
  await request(app).post(`/api/interviews/${interview.id}/evaluate`)
    .set("Authorization", `Bearer ${token}`).expect(200);

  const reports = await request(app).get("/api/reports")
    .set("Authorization", `Bearer ${token}`).expect(200);
  if (!reports.body.data.length) throw new Error("report list is empty");

  await request(app).get(`/api/reports/${reports.body.data[0].id}/download`)
    .set("Authorization", `Bearer ${token}`).expect("Content-Type", /application\/pdf/);
  await request(app).get("/api/reports/progress?period=week")
    .set("Authorization", `Bearer ${token}`).expect(200);
  await request(app).delete("/api/settings/data")
    .set("Authorization", `Bearer ${token}`)
    .send({ confirm: "DELETE" }).expect(200);

  await mongoose.disconnect();
  await mongo.stop();
  console.log("End-to-end QA passed");
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
