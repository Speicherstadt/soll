import { clockodoErsatz, WEBER_IN_CLOCKODO } from "./clockodo-ersatz.ts";

/**
 * The stand-in for Clockodo's API (S-703, built after the public SDK `clockodo`) as a server of its
 * own, for Playwright (scripts/e2e-server.ts): the API server fetches from it as from Clockodo
 * (SOLL_CLOCKODO_API). Never started outside the tests. Two records a page, so paging is exercised;
 * the access is the one e2e/umzug-clockodo.spec.ts types in.
 */
const PORT = 28211;
const E2E_CLOCKODO = { nutzer: "jonas@weber-haustechnik.test", schluessel: "ck_e2e_4711" };
const clockodo = clockodoErsatz({ ...E2E_CLOCKODO, daten: WEBER_IN_CLOCKODO, seitengroesse: 2 });
Bun.serve({ port: PORT, hostname: "127.0.0.1", fetch: (anfrage) => clockodo.fetch(anfrage) });
