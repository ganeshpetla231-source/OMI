const fs = require("fs");
const path = require("path");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../app");
const Skill = require("../models/Skill");

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

async function register(name = "Resource User") {
  const response = await request(app).post("/api/auth/register").send({
    name,
    email: `${name.toLowerCase().replace(/\s/g, "")}@example.com`,
    password: "Password1"
  });
  return response.body.data.token;
}

describe("Phase 6 notes and resumes", () => {
  test("notes CRUD, isolation, search, and topic filter", async () => {
    const token = await register();
    const otherToken = await register("Other User");

    const created = await request(app)
      .post("/api/notes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Node Design",
        content: "Node.js is a runtime. REST means representational state transfer.",
        topic: "backend",
        tags: ["node", "api"]
      });
    expect(created.status).toBe(201);
    expect(created.body.data.title).toBe("Node Design");

    const otherList = await request(app)
      .get("/api/notes")
      .set("Authorization", `Bearer ${otherToken}`);
    expect(otherList.body.data).toHaveLength(0);

    const searched = await request(app)
      .get("/api/notes?search=Node")
      .set("Authorization", `Bearer ${token}`);
    expect(searched.status).toBe(200);
    expect(searched.body.data).toHaveLength(1);

    const filtered = await request(app)
      .get("/api/notes?topic=backend")
      .set("Authorization", `Bearer ${token}`);
    expect(filtered.body.data).toHaveLength(1);

    const updated = await request(app)
      .put(`/api/notes/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated Node Design" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe("Updated Node Design");

    const deleted = await request(app)
      .delete(`/api/notes/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleted.status).toBe(200);
  });

  test("resume upload rejects wrong extension, wrong signature, and generates note source", async () => {
    const token = await register("Resume User");
    await Skill.create({ key: "node.js", label: "Node.js" });

    const wrongType = await request(app)
      .post("/api/resumes")
      .set("Authorization", `Bearer ${token}`)
      .attach("resume", Buffer.from("MZ fake executable"), { filename: "resume.exe", contentType: "application/octet-stream" });
    expect(wrongType.status).toBe(415);

    const fakePdf = await request(app)
      .post("/api/resumes")
      .set("Authorization", `Bearer ${token}`)
      .attach("resume", Buffer.from("MZ renamed executable"), { filename: "resume.pdf", contentType: "application/pdf" });
    expect(fakePdf.status).toBe(415);

    const note = await request(app)
      .post("/api/notes")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "JavaScript", content: "JavaScript is a programming language used in browsers.", topic: "technical" });
    const generated = await request(app)
      .post("/api/questions/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ count: 3, noteId: note.body.data.id });
    expect(generated.status).toBe(200);
    expect(generated.body.data.sources.notes).toBeGreaterThan(0);
  });

  test("PDF resume uploads and is removed on delete", async () => {
    const token = await register("PDF User");
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");
    const uploaded = await request(app)
      .post("/api/resumes")
      .set("Authorization", `Bearer ${token}`)
      .attach("resume", pdf, { filename: "profile.pdf", contentType: "application/pdf" });

    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data.originalName).toBe("profile.pdf");
    expect(uploaded.body.data.filePath).toBeUndefined();

    const resumePath = path.join(__dirname, "..", "uploads", "resumes", uploaded.body.data.storedName);
    expect(fs.existsSync(resumePath)).toBe(true);

    const deleted = await request(app)
      .delete(`/api/resumes/${uploaded.body.data.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleted.status).toBe(200);
    expect(fs.existsSync(resumePath)).toBe(false);
  });
});
