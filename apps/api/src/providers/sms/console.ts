import { logger } from "../../lib/logger.js";
import type { SmsProvider } from "./SmsProvider.js";

/** Dev provider: logs the OTP instead of sending it. Never used in production. */
export const consoleSmsProvider: SmsProvider = {
  id: "console",
  async sendOtp(phone, code) {
    logger.info({ phone, code }, `[dev-sms] OTP for ${phone}: ${code}`);
  },
};
