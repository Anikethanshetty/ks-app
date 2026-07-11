import { prisma } from "../lib/prisma.js";

/**
 * otp_codes access. Service-layer only — no actor scoping because there is no
 * actor yet at OTP time (the caller is unauthenticated). Never exposed to routes.
 */
export const otpRepository = {
  create(input: { phone: string; codeHash: string; expiresAt: Date }) {
    return prisma.otpCode.create({ data: input });
  },

  /** Latest un-consumed, un-expired code for a phone. */
  findLatestActive(phone: string) {
    return prisma.otpCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  },

  incrementAttempts(id: string) {
    return prisma.otpCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  },

  markConsumed(id: string) {
    return prisma.otpCode.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  },
};
