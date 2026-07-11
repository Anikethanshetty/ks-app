import { prisma } from "../lib/prisma.js";

/**
 * refresh_tokens access. Service-layer only (never exposed to routes). Stores
 * only the token HASH; the raw token exists solely on the client.
 */
export const refreshTokenRepository = {
  create(input: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    userAgent?: string | null;
  }) {
    return prisma.refreshToken.create({ data: input });
  },

  findByHash(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  revoke(id: string) {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  /** Reuse of a revoked token nukes the whole rotation chain (TRD §5.2). */
  revokeFamily(familyId: string) {
    return prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
