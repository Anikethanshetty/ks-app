import { execSync } from "node:child_process";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

export type Infra = {
  pg: StartedPostgreSqlContainer;
  redis: StartedTestContainer;
  stop: () => Promise<void>;
};

/**
 * Boots throwaway Postgres + Redis containers, points the app's env at them, and
 * applies the migrations. Import app modules only AFTER calling this so their
 * singletons (Prisma, Redis) bind to the containers, not to dev infra.
 */
export async function startInfra(): Promise<Infra> {
  const pg = await new PostgreSqlContainer("postgres:16").start();
  const redis = await new GenericContainer("redis:7").withExposedPorts(6379).start();

  process.env.DATABASE_URL = pg.getConnectionUri();
  process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;

  execSync("pnpm exec prisma migrate deploy", {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  return {
    pg,
    redis,
    stop: async () => {
      await redis.stop();
      await pg.stop();
    },
  };
}
