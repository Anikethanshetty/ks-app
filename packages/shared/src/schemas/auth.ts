import { z } from "zod";
import { Language, Role } from "../enums.js";

/** E.164, e.g. +919876543210. */
export const Phone = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone must be E.164, e.g. +919876543210");

export const OtpRequestBody = z.object({ phone: Phone });
export type OtpRequestBody = z.infer<typeof OtpRequestBody>;

export const OtpRequestResponse = z.object({
  requested: z.literal(true),
  // Never the code. Present only so dev clients can show a hint.
  devHint: z.string().optional(),
});
export type OtpRequestResponse = z.infer<typeof OtpRequestResponse>;

export const OtpVerifyBody = z.object({
  phone: Phone,
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});
export type OtpVerifyBody = z.infer<typeof OtpVerifyBody>;

export const RefreshBody = z.object({ refreshToken: z.string().min(1) });
export type RefreshBody = z.infer<typeof RefreshBody>;

export const LogoutBody = z.object({ refreshToken: z.string().min(1) });
export type LogoutBody = z.infer<typeof LogoutBody>;

/** What the client is ever allowed to see about a user. No cost/internal fields. */
export const PublicUser = z.object({
  id: z.string().uuid(),
  phone: Phone,
  fullName: z.string().nullable(),
  role: Role,
  language: Language,
});
export type PublicUser = z.infer<typeof PublicUser>;

export const AuthTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: PublicUser,
  isNewUser: z.boolean(),
});
export type AuthTokens = z.infer<typeof AuthTokens>;

export const TokenPair = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type TokenPair = z.infer<typeof TokenPair>;

/** PATCH /me — `role` and `isBlocked` are deliberately absent (§5.3). */
export const MePatchBody = z.object({
  fullName: z.string().min(1).max(120).optional(),
  language: Language.optional(),
});
export type MePatchBody = z.infer<typeof MePatchBody>;

export const OkResponse = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponse>;
