import { PETERSEN } from "@soll/import/zeiterfasser-fixtures";
import { clockifyErsatz } from "./clockify-ersatz.ts";
import { togglErsatz } from "./toggl-ersatz.ts";

/**
 * Stand-in server for Toggl Track and Clockify (BAULISTE.md S-707) for Playwright
 * (scripts/e2e-server.ts, SOLL_TOGGL_API / SOLL_CLOCKIFY_API). Never started outside tests.
 */
const PORT = 28216;

const toggl = togglErsatz({
  token: "toggl-e2e",
  daten: PETERSEN.toggl,
});

const clockify = clockifyErsatz({
  schluessel: "clockify-e2e",
  daten: PETERSEN.clockify,
  seitengroesse: 2,
});

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  fetch: (anfrage) => {
    const pfad = new URL(anfrage.url).pathname;
    if (pfad === "/me" || pfad.startsWith("/me/")) return toggl.fetch(anfrage);
    return clockify.fetch(anfrage);
  },
});
