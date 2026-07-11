import bcrypt from "bcryptjs";
import { RATE_LIMITS } from "@kss/shared";
import { isProduction } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { generateOtpCode } from "../lib/crypto.js";
import { allowWithinWindow } from "../lib/rateLimit.js";
import { otpRepository } from "../repositories/otp.repository.js";
import { smsProvider } from "../providers/sms/index.js";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes (schema §3.1)
const OTP_MAX_ATTEMPTS = 3;
const BCRYPT_ROUNDS = 10;
const DEV_FIXED_CODE = "000000";

export const otpService = {
  /**
   * Issues an OTP. Rate limited 5/hour/phone and 20/hour/IP in Redis. The code
   * is hashed (bcrypt) before storage — the plaintext never touches the DB.
   */
  async request(phone: string, ip: string): Promise<{ devHint?: string }> {
    const [phoneOk, ipOk] = await Promise.all([
      allowWithinWindow(`otp:phone:${phone}`, RATE_LIMITS.otpPerPhonePerHour, 3600),
      allowWithinWindow(`otp:ip:${ip}`, RATE_LIMITS.otpPerIpPerHour, 3600),
    ]);
    if (!phoneOk || !ipOk) throw new AppError("RATE_LIMITED", "Too many OTP requests.");

    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    await otpRepository.create({
      phone,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    await smsProvider.sendOtp(phone, code);

    // Dev accepts a fixed code, so hint the tester (never in production).
    return isProduction ? {} : { devHint: `dev OTP is ${DEV_FIXED_CODE} or the logged code` };
  },

  /**
   * Verifies a code for a phone. Throws OTP_EXPIRED / OTP_INVALID /
   * OTP_MAX_ATTEMPTS. On success, consumes the code and returns nothing.
   */
  async verify(phone: string, code: string): Promise<void> {
    // Dev bypass (NODE_ENV !== 'production'): a fixed code always works.
    if (!isProduction && code === DEV_FIXED_CODE) return;

    const otp = await otpRepository.findLatestActive(phone);
    if (!otp) throw new AppError("OTP_EXPIRED", "No valid code. Request a new one.");

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await otpRepository.markConsumed(otp.id);
      throw new AppError("OTP_MAX_ATTEMPTS", "Too many attempts. Request a new code.");
    }

    const ok = await bcrypt.compare(code, otp.codeHash);
    if (!ok) {
      await otpRepository.incrementAttempts(otp.id);
      throw new AppError("OTP_INVALID", "Incorrect code.");
    }

    await otpRepository.markConsumed(otp.id);
  },
};
