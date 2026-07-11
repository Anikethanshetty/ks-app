import { PrismaClient } from "@prisma/client";
import { isProduction } from "../config/env.js";

/**
 * The single Prisma client for the process. Repositories are the only layer that
 * imports this (TRD §1); every repository method scopes its query by the actor.
 */
export const prisma = new PrismaClient({
  log: isProduction ? ["warn", "error"] : ["warn", "error"],
});
