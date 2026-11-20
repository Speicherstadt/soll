import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The API for Playwright (playwright.config.ts): a fresh database in an empty temporary directory, never
 * one with real data (CLAUDE.md), on the e2e port, with a key that holds for this run only. The web
 * app's Vite server forwards /api here, so the browser sees one origin.
 */
const server = Bun.spawn(["bun", "apps/server/src/main.ts"], {
  env: {
    ...process.env,
    SOLL_PORT: "28200",
    SOLL_HOST: "127.0.0.1",
    SOLL_DATA_DIR: mkdtempSync(join(tmpdir(), "soll-e2e-")),
    SOLL_SECRET_KEY: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64"),
    // the origin the browser calls from (the Vite server on the e2e port), for Better Auth's origin check
    SOLL_URL: "http://localhost:5178",
  },
  stdout: "inherit",
  stderr: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.kill(signal));
process.exit(await server.exited);
