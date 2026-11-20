import { defineConfig } from "vitest/config";

// One run over the whole monorepo; packages keep their tests next to the code.
export default defineConfig({
  test: {
    include: ["{apps,packages,scripts}/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // The tests run under Bun (`bun --bun vitest`), so database tests use bun:sqlite as the server
    // does; Bun has no IPC channel for vitest's forks, threads work
    pool: "threads",
  },
});
