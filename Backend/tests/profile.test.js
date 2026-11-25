const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../app");
const User = require("../models/User");

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

async function register() {
  const response = await request(app).post("/api/auth/register").send({
    name: "Profile User",
    email: "profile@example.com",
    password: "Password1"
  });
  return response.body.data;
}

describe("Phase 2 profile and settings", () => {
  test("profile get and partial update with de-duplicated skills", async () => {
    const { token } = await register();

    const getResponse = await request(app)
      .get("/api/profile")
      .set("Authorization", `Bearer ${token}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.email).toBe("profile@example.com");

    const updateResponse = await request(app)
      .put("/api/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({
        careerGoal: "Become a backend engineer",
        skills: [" Java ", "java", "Node.js", "node.JS"]
      });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.careerGoal).toBe("Become a backend engineer");
    expect(updateResponse.body.data.skills).toEqual(["Java", "Node.js"]);
  });

  test("preferences reject invalid enum values", async () => {
    const { token } = await register();

    const response = await request(app)
      .put("/api/profile/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ theme: "blue", interviewMode: "unknown" });

    expect(response.status).toBe(400);
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  test("settings create defaults and merge nested updates", async () => {
    const { token } = await register();

    const getResponse = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${token}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.language).toBe("en");
    expect(getResponse.body.data.offline.autoSync).toBe(true);

    const updateResponse = await request(app)
      .put("/api/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        offline: { autoSync: false },
        notifications: { interviewReminders: false }
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.offline.autoSync).toBe(false);
    expect(updateResponse.body.data.offline.keepRecordings).toBe(true);
    expect(updateResponse.body.data.notifications.interviewReminders).toBe(false);
    expect(updateResponse.body.data.notifications.progressUpdates).toBe(true);
  });

  test("delete profile wrong password and successful account deletion", async () => {
    const { token } = await register();

    const wrong = await request(app)
      .delete("/api/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "Wrongpass1" });
    expect(wrong.status).toBe(401);

    const deleted = await request(app)
      .delete("/api/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "Password1" });
    expect(deleted.status).toBe(200);

    const login = await request(app).post("/api/auth/login").send({
      email: "profile@example.com",
      password: "Password1"
    });
    expect(login.status).toBe(401);
  });

  test("delete settings data keeps account and settings", async () => {
    const { token } = await register();

    await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${token}`);

    const response = await request(app)
      .delete("/api/settings/data")
      .set("Authorization", `Bearer ${token}`)
      .send({ confirm: "DELETE" });
    expect(response.status).toBe(200);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);

    const settings = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${token}`);
    expect(settings.status).toBe(200);
  });
});
