import { kimaiErsatz, WEBER_IN_KIMAI } from "./kimai-ersatz.ts";

/**
 * The stand-in for a Kimai instance (S-705, built after Kimai's source) as a server of its own, for
 * Playwright (scripts/e2e-server.ts): the API server fetches from it through the guarded connection,
 * its origin allowed with SOLL_IMPORT_ALLOWED_ORIGINS. Never started outside the tests. Two records
 * a page, so paging is exercised; every timesheet is the owner's, the only member of the business
 * Playwright creates; the token is the one e2e/umzug-kimai.spec.ts types in.
 */
const PORT = 28213;
const kimai = kimaiErsatz({
  token: "kimai_e2e_4711",
  daten: {
    ...WEBER_IN_KIMAI,
    timesheets: WEBER_IN_KIMAI.timesheets.map((t) => ({ ...t, user: 1 })),
  },
  seitengroesse: 2,
});
Bun.serve({ port: PORT, hostname: "127.0.0.1", fetch: (anfrage) => kimai.fetch(anfrage) });
