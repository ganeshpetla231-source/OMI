const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");

describe("Phase 0 foundation", () => {
  afterAll(async () => {
    await mongoose.disconnect();
  });

  test("GET /api/health returns 200", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "API is healthy",
      data: {
        status: "ok"
      }
    });
  });

  test("GET /api/health/database returns 503 when disconnected", async () => {
    const response = await request(app).get("/api/health/database");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      message: "Database unavailable",
      errors: []
    });
  });

  test("GET /api/health/database returns 200 when connected", async () => {
    Object.defineProperty(mongoose.connection, "readyState", {
      configurable: true,
      value: 1
    });

    const response = await request(app).get("/api/health/database");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Database is healthy",
      data: {
        status: "ok",
        database: "connected"
      }
    });
    delete mongoose.connection.readyState;
  });

  test("unknown route returns standard 404 JSON", async () => {
    const response = await request(app).get("/api/unknown");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: "Route not found",
      errors: []
    });
  });

  test("thrown error returns standard error JSON", async () => {
    const response = await request(app).get("/api/test/error");
    expect(response.status).toBe(418);
    expect(response.body).toEqual({
      success: false,
      message: "Test error",
      errors: []
    });
  });
});
