import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { pool } from "./lib/db.js";
import { redis } from "./lib/redis.js";
import { closeSocketIO } from "./lib/socket.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const app = await buildServer();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(`API listening on :${env.PORT} (${env.NODE_ENV})`);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down`);
    try {
      await closeSocketIO();
      await app.close();
      await pool.end();
      redis.disconnect();
    } catch (err) {
      logger.error({ err }, "Error during shutdown");
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal boot error");
  process.exit(1);
});
