import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

/**
 * Validates process.env at boot and CRASHES on a missing/invalid required var.
 * Fail loudly at startup, not mysteriously at 2 a.m. (TRD §9.3).
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(8080),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // 32+ random bytes each. TRD §11.
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // Comma-separated allowed origins for CORS.
  CORS_ORIGINS: z.string().min(1),

  // External services — used from the phase that introduces them. Optional in dev.
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  SARVAM_API_KEY: z.string().optional(),
  GOOGLE_STT_API_KEY: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`\n✖ Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const isProduction = env.NODE_ENV === "production";
