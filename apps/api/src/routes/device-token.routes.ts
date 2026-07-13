import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";

const RegisterTokenBody = z.object({
  token: z.string().min(1),
  platform: z.string().optional(),
});

const OkResponse = z.object({ ok: z.literal(true) });

export const deviceTokenRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", authenticate);

  // Register or update a push notification device token
  app.post(
    "/device-tokens",
    {
      preHandler: authorize("customer", "delivery", "admin"),
      schema: {
        tags: ["devices"],
        summary: "Register or update a push notification device token",
        body: RegisterTokenBody,
        response: { 200: OkResponse },
      },
    },
    async (req) => {
      const { token, platform } = req.body;
      await prisma.deviceToken.upsert({
        where: { token },
        create: {
          userId: req.actor!.userId,
          token,
          platform: platform ?? null,
        },
        update: {
          userId: req.actor!.userId,
          platform: platform ?? null,
        },
      });
      return { ok: true as const };
    },
  );

  // Unregister a device token
  app.delete(
    "/device-tokens/:token",
    {
      preHandler: authorize("customer", "delivery", "admin"),
      schema: {
        tags: ["devices"],
        summary: "Unregister a device token",
        params: z.object({ token: z.string().min(1) }),
        response: { 200: OkResponse },
      },
    },
    async (req) => {
      await prisma.deviceToken.deleteMany({
        where: { token: req.params.token, userId: req.actor!.userId },
      });
      return { ok: true as const };
    },
  );
};
