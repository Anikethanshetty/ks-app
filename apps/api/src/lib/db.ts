import { Pool } from "pg";
import { env } from "../config/env.js";

/**
 * Lightweight pg pool used for liveness/readiness checks in the T0.1 skeleton.
 * The application data layer (Prisma) is introduced in T0.2 and will own queries.
 */
export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 4 });

export async function pingPostgres(): Promise<boolean> {
  try {
    const res = await pool.query("SELECT 1 AS ok");
    return res.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}
