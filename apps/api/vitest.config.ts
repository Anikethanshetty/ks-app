import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 180_000, // pulling + booting Testcontainers is slow the first time
    fileParallelism: false,
    pool: "forks",
  },
});
