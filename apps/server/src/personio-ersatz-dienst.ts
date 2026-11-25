import { personioErsatz, WEBER_IN_PERSONIO } from "./personio-ersatz.ts";

/**
 * The stand-in for Personio's API v2 (S-704, built after Personio's descriptions) as a server of its
 * own, for Playwright (scripts/e2e-server.ts): the API server fetches from it instead of
 * api.personio.de (SOLL_PERSONIO_API). Never started outside the tests. Two records a page, so the
 * cursor is followed; every period is Jonas's, the owner and only member of the business Playwright
 * creates; the credentials are the ones e2e/umzug-personio.spec.ts types in.
 */
const PORT = 28214;
const daten = WEBER_IN_PERSONIO;
const personio = personioErsatz({
  clientId: "papi-e2e-4711",
  clientSecret: "papi-e2e-secret",
  daten: {
    ...daten,
    attendancePeriods: daten.attendancePeriods.map((p) => ({ ...p, person: { id: "1001" } })),
    absencePeriods: daten.absencePeriods.map((p) => ({ ...p, person: { id: "1001" } })),
  },
  seitengroesse: 2,
});
Bun.serve({ port: PORT, hostname: "127.0.0.1", fetch: (anfrage) => personio.fetch(anfrage) });
