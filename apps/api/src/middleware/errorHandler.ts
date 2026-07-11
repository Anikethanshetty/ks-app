import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import type { ErrorResponse } from "@kss/shared";
import { AppError, ERROR_STATUS } from "../lib/errors.js";

/**
 * Global error handler: maps AppError → { error: { code, message } } with the
 * right status, Zod validation failures → 400 VALIDATION_ERROR, and anything
 * unexpected → 500 INTERNAL_ERROR with no internals leaked to the client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerErrorHandler(app: FastifyInstance<any, any, any, any, any>): void {
  app.setErrorHandler(
    (err: FastifyError, req: FastifyRequest, reply: FastifyReply): FastifyReply => {
      if (err instanceof AppError) {
        const status = ERROR_STATUS[err.code];
        req.log.warn({ code: err.code, details: err.details }, err.message);
        const body: ErrorResponse = {
          error: { code: err.code, message: err.message, details: err.details },
        };
        return reply.status(status).send(body);
      }

      if (hasZodFastifySchemaValidationErrors(err)) {
        const body: ErrorResponse = {
          error: {
            code: "VALIDATION_ERROR",
            message: "Request failed validation.",
            details: { issues: err.validation },
          },
        };
        return reply.status(400).send(body);
      }

      // @fastify/rate-limit sets statusCode 429.
      if (err.statusCode === 429) {
        const body: ErrorResponse = {
          error: { code: "RATE_LIMITED", message: "Too many requests." },
        };
        return reply.status(429).send(body);
      }

      req.log.error({ err }, "Unhandled error");
      const body: ErrorResponse = {
        error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
      };
      return reply.status(500).send(body);
    },
  );

  app.setNotFoundHandler((_req, reply) => {
    const body: ErrorResponse = {
      error: { code: "NOT_FOUND", message: "Resource not found." },
    };
    return reply.status(404).send(body);
  });
}
