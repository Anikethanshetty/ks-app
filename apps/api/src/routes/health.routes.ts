import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { HealthResponse, ReadyResponse } from "@kss/shared";
import { pingPostgres } from "../lib/db.js";
import { pingRedis } from "../lib/redis.js";

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["ops"],
        summary: "Liveness probe",
        response: { 200: HealthResponse },
      },
    },
    async () => ({ status: "ok" as const, uptime: process.uptime() }),
  );

  app.get(
    "/ready",
    {
      schema: {
        tags: ["ops"],
        summary: "Readiness probe (Postgres + Redis reachable)",
        response: { 200: ReadyResponse, 503: ReadyResponse },
      },
    },
    async (_req, reply) => {
      const [postgres, redis] = await Promise.all([
        pingPostgres(),
        pingRedis(),
      ]);
      const ready = postgres && redis;
      const body = {
        status: (ready ? "ready" : "degraded") as "ready" | "degraded",
        checks: { postgres, redis },
      };
      return reply.status(ready ? 200 : 503).send(body);
    },
  );
};
