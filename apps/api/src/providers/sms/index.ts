import { env, isProduction } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { consoleSmsProvider } from "./console.js";
import { createMsg91Provider } from "./msg91.js";
import type { SmsProvider } from "./SmsProvider.js";

/**
 * Picks the SMS provider once at boot. MSG91 when configured; otherwise the dev
 * console provider. In production a missing MSG91 config is fatal — OTP is the
 * only way in, so silently logging codes to stdout would be a security hole.
 */
function selectProvider(): SmsProvider {
  if (env.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID) {
    return createMsg91Provider();
  }
  if (isProduction) {
    throw new Error(
      "No SMS provider configured in production (set MSG91_AUTH_KEY + MSG91_TEMPLATE_ID)",
    );
  }
  logger.warn("No MSG91 config — using console SMS provider (dev only)");
  return consoleSmsProvider;
}

export const smsProvider: SmsProvider = selectProvider();
export type { SmsProvider } from "./SmsProvider.js";
