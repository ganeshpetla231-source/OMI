const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../app");
const User = require("../models/User");
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

async function register(name = "Student", role = "student") {
  const email = `${name.toLowerCase().replace(/\s/g, "")}@example.com`;
  const response = await request(app).post("/api/auth/register").send({
    name,
    email,
    password: "Password1"
  });
  if (role === "admin") {
    await User.updateOne({ email }, { $set: { role: "admin" } });
  }
  return response.body.data.token;
}

async function createQuestion(overrides = {}) {
  return Question.create({
    seedKey: `test-${Date.now()}-${Math.random()}`,
    text: "Explain how you would design a reliable REST API.",
    category: "technical",
    jobRole: "Software Engineer",
    skill: "Node.js",
    difficulty: "medium",
    language: "en",
    expectedAnswer: "Discuss validation, errors, authentication, testing, and monitoring.",
    keywords: ["validation", "authentication", "testing", "monitoring"],
    tags: ["api", "backend"],
    evaluationCriteria: ["Clear structure", "Security", "Testing"],
    timeLimitSeconds: 180,
    isActive: true,
    ...overrides
  });
}

describe("Phase 3 questions and admin", () => {
  test("list, categories, filters, search, and pagination", async () => {
    await createQuestion();
    await createQuestion({ category: "coding", text: "Explain a binary search implementation." });
    const Category = require("../models/Category");
    await Category.create([
      { key: "technical", label: "Technical", description: "Technical" },
      { key: "coding", label: "Coding", description: "Coding" }
    ]);

    const list = await request(app).get("/api/questions?page=1&limit=1");
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.pagination.total).toBe(2);

    const search = await request(app).get("/api/questions?search=REST");
    expect(search.status).toBe(200);
    expect(search.body.data.length).toBeGreaterThanOrEqual(1);

    const categories = await request(app).get("/api/questions/categories");
    expect(categories.status).toBe(200);
    expect(categories.body.data.find((item) => item.key === "technical").questionCount).toBe(1);
  });

  test("random has no duplicates and respects count", async () => {
    await Promise.all([
      createQuestion({ seedKey: "random-1" }),
      createQuestion({ seedKey: "random-2", text: "How would you use SQL indexes effectively?" }),
      createQuestion({ seedKey: "random-3", text: "Describe your approach to code review." })
    ]);

    const response = await request(app).get("/api/questions/random?count=3");
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(3);
    expect(new Set(response.body.data.map((item) => item.id)).size).toBe(3);
  });

  test("generate returns requested count and no duplicates", async () => {
    await createQuestion();
    const token = await register("Generator");
    const response = await request(app)
      .post("/api/questions/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ count: 5, category: "technical", difficulty: "medium", language: "en" });

    expect(response.status).toBe(200);
    expect(response.body.data.questions).toHaveLength(5);
    expect(new Set(response.body.data.questions.map((item) => item.text)).size).toBe(5);
  });

  test("categories static route is not treated as an id", async () => {
    await createQuestion();
    const response = await request(app).get("/api/questions/categories");
    expect(response.status).toBe(200);
  });

  test("student cannot use admin routes", async () => {
    const token = await register("Student User");
    const studentResponse = await request(app)
      .post("/api/admin/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(studentResponse.status).toBe(403);

    const unauthenticated = await request(app).post("/api/admin/questions").send({});
    expect(unauthenticated.status).toBe(401);
  });

  test("admin invalid question body returns 400", async () => {
    const token = await register("Invalid Admin", "admin");
    const response = await request(app)
      .post("/api/admin/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "short" });
    expect(response.status).toBe(400);
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  test("admin can create, update, and delete questions", async () => {
    const token = await register("Admin User", "admin");
    const body = {
      text: "How would you improve the performance of a slow database query?",
      category: "technical",
      jobRole: "Data Analyst",
      skill: "SQL",
      difficulty: "medium",
      language: "en",
      expectedAnswer: "Inspect query plans, indexes, joins, and data access patterns.",
      keywords: ["indexes", "query plan", "joins", "caching"],
      tags: ["database", "performance"],
      evaluationCriteria: ["Diagnosis", "Indexing", "Validation"],
      timeLimitSeconds: 180
    };

    const created = await request(app)
      .post("/api/admin/questions")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    expect(created.status).toBe(201);

    const updated = await request(app)
      .put(`/api/admin/questions/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...body, difficulty: "hard" });
    expect(updated.status).toBe(200);

    const deleted = await request(app)
      .delete(`/api/admin/questions/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleted.status).toBe(200);
  });

  test("seeder creates useful idempotent question data", async () => {
    const { seedData } = require("../seeders/index");
    await seedData();
    await seedData();

    expect(await Question.countDocuments({ language: "en" })).toBe(120);
    expect(await Question.countDocuments({ language: "te" })).toBe(10);
    expect(await Question.countDocuments({ language: "hi" })).toBe(10);

    for (const category of ["hr", "technical", "general", "communication", "coding"]) {
      for (const difficulty of ["easy", "medium", "hard"]) {
        expect(await Question.countDocuments({ category, difficulty, language: "en" })).toBeGreaterThanOrEqual(5);
      }
    }
  });
});
