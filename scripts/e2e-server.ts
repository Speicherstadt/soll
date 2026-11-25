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
    // imports from Clockodo fetch from its stand-in (S-703), never from Clockodo itself
    SOLL_CLOCKODO_API: "http://127.0.0.1:28211/api",
    // imports from Kimai fetch from its stand-in on this machine (S-705), allowed by its origin
    SOLL_IMPORT_ALLOWED_ORIGINS: "http://127.0.0.1:28213",
    // imports from Personio fetch from its stand-in (S-704), never from api.personio.de
    SOLL_PERSONIO_API: "http://127.0.0.1:28214",
  },
  stdout: "inherit",
  stderr: "inherit",
});
// the stand-ins the tests connect to, each on its own port: Haben (S-606), Clockodo (S-703), Kimai
// (S-705) and Personio (S-704)
const ersatz = [
  "apps/server/src/haben-ersatz-dienst.ts",
  "apps/server/src/clockodo-ersatz-dienst.ts",
  "apps/server/src/kimai-ersatz-dienst.ts",
  "apps/server/src/personio-ersatz-dienst.ts",
].map((datei) => Bun.spawn(["bun", datei], { stdout: "inherit", stderr: "inherit" }));
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    for (const dienst of ersatz) dienst.kill(signal);
    server.kill(signal);
  });
const code = await server.exited;
for (const dienst of ersatz) dienst.kill();
process.exit(code);
