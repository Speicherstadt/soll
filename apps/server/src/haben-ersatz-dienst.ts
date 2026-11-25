import { habenErsatz } from "./haben-ersatz.ts";

/**
 * The stand-in for Haben (S-606, built from Haben's docs/api.md) as a server of its own, for
 * Playwright (scripts/e2e-server.ts): the e2e tests keep its address and token as a business's
 * access, and the API server calls it like a real Haben. Never started outside the tests.
 */
const PORT = 28210;
const haben = habenErsatz({
  basis: `http://127.0.0.1:${PORT}`,
  token: "hb_e2e",
  kontakte: [
    {
      id: "8b0c2f4e-1d7a-4c3b-9e5f-0a1b2c3d4e5f",
      name: "Elbhof Immobilien GmbH",
      kundennummer: "K-1001",
    },
  ],
});
Bun.serve({ port: PORT, hostname: "127.0.0.1", fetch: (anfrage) => haben.fetch(anfrage) });
