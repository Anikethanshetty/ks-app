import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { MePatchBody, PublicUser } from "@kss/shared";
import { AppError } from "../lib/errors.js";
import { toPublicUser } from "../lib/mappers.js";
import { authenticate } from "../middleware/authenticate.js";
import { userRepository } from "../repositories/user.repository.js";

export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  // Every route in this plugin requires a valid access token.
  app.addHook("preHandler", authenticate);

  app.get(
    "/me",
    { schema: { tags: ["auth"], summary: "Current user", response: { 200: PublicUser } } },
    async (req) => {
      const user = await userRepository.findSelf(req.actor!);
      if (!user) throw new AppError("NOT_FOUND", "User not found.");
      return toPublicUser(user);
    },
  );

  app.patch(
    "/me",
    {
      schema: {
        tags: ["auth"],
        summary: "Update own profile (role is not an accepted field)",
        body: MePatchBody,
        response: { 200: PublicUser },
      },
    },
    async (req) => {
      // MePatchBody has no `role`/`isBlocked`, so Zod strips them before we run.
      const user = await userRepository.updateSelf(req.actor!, req.body);
      return toPublicUser(user);
    },
  );
};
