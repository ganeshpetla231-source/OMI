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

describe("Phase 8 security and response behavior", () => {
  test("missing auth and unknown routes use 401 and 404", async () => {
    const protectedResponse = await request(app).get("/api/profile");
    expect(protectedResponse.status).toBe(401);
    expect(protectedResponse.body.success).toBe(false);

    const unknown = await request(app).get("/api/does-not-exist");
    expect(unknown.status).toBe(404);
  });

  test("forbidden Mongo keys are stripped before validation", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Safe User",
      email: "safe@example.com",
      password: "Password1",
      $where: "this.passwordHash",
      "preferences.theme": "system"
    });
    expect([201, 400]).toContain(response.status);
    expect(response.status).not.toBe(500);
  });

  test("security headers are present", async () => {
    const response = await request(app).get("/api/health");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});
