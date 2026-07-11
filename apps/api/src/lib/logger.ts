import { pino } from "pino";
import { env, isProduction } from "../config/env.js";

/**
 * Structured JSON logs. Redaction paths keep secrets out of logs (TRD §9.3):
 * never a JWT, an OTP, a full phone number, or a UTR.
 */
export const logger = pino({
  level: isProduction ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.body.code",
      "req.body.utr",
      "req.body.phone",
      "*.accessToken",
      "*.refreshToken",
    ],
    censor: "[redacted]",
  },
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
      },
  base: { env: env.NODE_ENV },
});
