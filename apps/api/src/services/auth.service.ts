import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import type { AuthTokens, TokenPair } from "@kss/shared";
import { AppError } from "../lib/errors.js";
import { generateOpaqueToken, hashToken } from "../lib/crypto.js";
import { signAccessToken } from "../lib/jwt.js";
import { toPublicUser } from "../lib/mappers.js";
import { userRepository } from "../repositories/user.repository.js";
import { refreshTokenRepository } from "../repositories/refreshToken.repository.js";
import { otpService } from "./otp.service.js";

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Issues a fresh access token + a rotating refresh token in the given family. */
async function issueTokenPair(
  user: User,
  userAgent: string | null,
  familyId: string,
): Promise<TokenPair> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const rawRefresh = generateOpaqueToken();
  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashToken(rawRefresh),
    familyId,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent,
  });
  return { accessToken, refreshToken: rawRefresh };
}

export const authService = {
  /** OTP verify → tokens. Creates the user on first login. */
  async verifyOtpAndIssue(
    phone: string,
    code: string,
    userAgent: string | null,
  ): Promise<AuthTokens> {
    await otpService.verify(phone, code);

    const { user, isNewUser } = await userRepository.upsertByPhoneForAuth(phone);
    if (user.isBlocked) throw new AppError("FORBIDDEN", "This account is blocked.");

    const pair = await issueTokenPair(user, userAgent, randomUUID());
    return { ...pair, user: toPublicUser(user), isNewUser };
  },

  /**
   * Rotates a refresh token. Reuse of an already-revoked token is treated as a
   * theft signal: the entire family is revoked and the caller is forced to
   * re-login (TRD §5.2).
   */
  async refresh(rawToken: string, userAgent: string | null): Promise<TokenPair> {
    const row = await refreshTokenRepository.findByHash(hashToken(rawToken));
    if (!row) throw new AppError("TOKEN_INVALID", "Invalid refresh token.");

    if (row.revokedAt) {
      await refreshTokenRepository.revokeFamily(row.familyId);
      throw new AppError(
        "REFRESH_REUSE_DETECTED",
        "Session reuse detected. Please log in again.",
      );
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new AppError("TOKEN_EXPIRED", "Refresh token expired. Please log in again.");
    }

    const user = await userRepository.findByIdForAuth(row.userId);
    if (!user || user.isBlocked) throw new AppError("FORBIDDEN", "This account is blocked.");

    // Rotate: revoke the presented token, issue a new one in the SAME family.
    await refreshTokenRepository.revoke(row.id);
    return issueTokenPair(user, userAgent, row.familyId);
  },

  /** Revokes the presented refresh token. Idempotent. */
  async logout(rawToken: string): Promise<void> {
    const row = await refreshTokenRepository.findByHash(hashToken(rawToken));
    if (row && !row.revokedAt) await refreshTokenRepository.revoke(row.id);
  },
};
