import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import type { SmsProvider } from "./SmsProvider.js";

/**
 * MSG91 OTP SMS (India). Uses the transactional OTP endpoint with the configured
 * template. Requires MSG91_AUTH_KEY and MSG91_TEMPLATE_ID.
 */
export function createMsg91Provider(): SmsProvider {
  const authKey = env.MSG91_AUTH_KEY;
  const templateId = env.MSG91_TEMPLATE_ID;
  if (!authKey || !templateId) {
    throw new Error(
      "MSG91 provider requires MSG91_AUTH_KEY and MSG91_TEMPLATE_ID",
    );
  }

  return {
    id: "msg91",
    async sendOtp(phone, code) {
      // MSG91 wants the number without the leading '+'.
      const mobile = phone.replace(/^\+/, "");
      const res = await fetch("https://control.msg91.com/api/v5/otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: authKey,
        },
        body: JSON.stringify({
          template_id: templateId,
          mobile,
          otp: code,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        logger.error({ status: res.status, text }, "MSG91 send failed");
        throw new Error(`MSG91 send failed: ${res.status}`);
      }
    },
  };
}
