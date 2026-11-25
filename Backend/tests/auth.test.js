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
  await User.deleteMany({});
});

describe("Phase 1 authentication", () => {
  test("register success and role cannot be injected", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Student One",
      email: "student@example.com",
      password: "Password1",
      role: "admin"
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.role).toBe("student");
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.user.tokenVersion).toBeUndefined();
  });

  test("duplicate registration returns 409", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Student One",
      email: "duplicate@example.com",
      password: "Password1"
    });
    const response = await request(app).post("/api/auth/register").send({
      name: "Student Two",
      email: "duplicate@example.com",
      password: "Password1"
    });

    expect(response.status).toBe(409);
  });

  test("weak password returns 400 field errors", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Student One",
      email: "weak@example.com",
      password: "weak"
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  test("login success and wrong password use standard 401", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login User",
      email: "login@example.com",
      password: "Password1"
    });

    const success = await request(app).post("/api/auth/login").send({
      email: "login@example.com",
      password: "Password1"
    });
    expect(success.status).toBe(200);
    expect(success.body.data.token).toEqual(expect.any(String));

    const failure = await request(app).post("/api/auth/login").send({
      email: "login@example.com",
      password: "Wrongpass1"
    });
    expect(failure.status).toBe(401);
    expect(failure.body.message).toBe("Invalid email or password");
  });

  test("me requires a token and accepts a valid token", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      name: "Me User",
      email: "me@example.com",
      password: "Password1"
    });

    const unauthorized = await request(app).get("/api/auth/me");
    expect(unauthorized.status).toBe(401);

    const authorized = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${registration.body.data.token}`);
    expect(authorized.status).toBe(200);
    expect(authorized.body.data.email).toBe("me@example.com");
  });

  test("logout invalidates the old token", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      name: "Logout User",
      email: "logout@example.com",
      password: "Password1"
    });
    const token = registration.body.data.token;

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(logout.status).toBe(200);

    const oldToken = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(oldToken.status).toBe(401);
  });

  test("change-password verifies current password and issues a fresh token", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      name: "Change User",
      email: "change@example.com",
      password: "Password1"
    });
    const token = registration.body.data.token;

    const wrong = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "Wrongpass1", newPassword: "Password2" });
    expect(wrong.status).toBe(400);

    const changed = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "Password1", newPassword: "Password2" });
    expect(changed.status).toBe(200);
    expect(changed.body.data.token).toEqual(expect.any(String));

    const oldToken = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(oldToken.status).toBe(401);

    const login = await request(app).post("/api/auth/login").send({
      email: "change@example.com",
      password: "Password2"
    });
    expect(login.status).toBe(200);
  });
});
