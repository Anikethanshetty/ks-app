import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  AuthTokens,
  LogoutBody,
  OkResponse,
  OtpRequestBody,
  OtpRequestResponse,
  OtpVerifyBody,
  RefreshBody,
  TokenPair,
} from "@kss/shared";
import { authService } from "../services/auth.service.js";
import { otpService } from "../services/otp.service.js";

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/auth/otp/request",
    {
      schema: {
        tags: ["auth"],
        summary: "Request an OTP (rate limited 5/h/phone, 20/h/IP)",
        body: OtpRequestBody,
        response: { 200: OtpRequestResponse },
      },
    },
    async (req) => {
      const { devHint } = await otpService.request(req.body.phone, req.ip);
      return { requested: true as const, ...(devHint ? { devHint } : {}) };
    },
  );

  app.post(
    "/auth/otp/verify",
    {
      schema: {
        tags: ["auth"],
        summary: "Verify an OTP → access + rotating refresh token",
        body: OtpVerifyBody,
        response: { 200: AuthTokens },
      },
    },
    async (req) => {
      const userAgent = req.headers["user-agent"] ?? null;
      return authService.verifyOtpAndIssue(req.body.phone, req.body.code, userAgent);
    },
  );

  app.post(
    "/auth/refresh",
    {
      schema: {
        tags: ["auth"],
        summary: "Rotate the refresh token (reuse revokes the whole family)",
        body: RefreshBody,
        response: { 200: TokenPair },
      },
    },
    async (req) => {
      const userAgent = req.headers["user-agent"] ?? null;
      return authService.refresh(req.body.refreshToken, userAgent);
    },
  );

  app.post(
    "/auth/logout",
    {
      schema: {
        tags: ["auth"],
        summary: "Revoke a refresh token",
        body: LogoutBody,
        response: { 200: OkResponse },
      },
    },
    async (req) => {
      await authService.logout(req.body.refreshToken);
      return { ok: true as const };
    },
  );
};
