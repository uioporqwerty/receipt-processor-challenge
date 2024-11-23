import { FastifyInstance } from "fastify";
import { describe, it, expect } from "@jest/globals";

import { buildServer } from "../src/server";

describe("Fastify API", () => {
  let fastify: FastifyInstance;

  beforeAll(() => {
    fastify = buildServer();
  });

  afterAll(() => {
    fastify.close();
  });

  it("should return status ok for /health", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
