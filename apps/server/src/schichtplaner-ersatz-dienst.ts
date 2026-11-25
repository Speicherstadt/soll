import { ELBBLICK } from "@soll/import/fixtures";
import { crewmeisterErsatz } from "./crewmeister-ersatz.ts";
import { papershiftErsatz } from "./papershift-ersatz.ts";
import { plandayErsatz } from "./planday-ersatz.ts";

/**
 * The stand-ins for Papershift, Planday and Crewmeister (S-706, built after each tool's sources) as
 * one server of its own, for Playwright (scripts/e2e-server.ts, SOLL_SCHICHTPLANER_API): their paths
 * do not overlap (`/public_api/v1`, `/connect/token` and Planday's, `/api/v3`). Never started
 * outside the tests. Tom's records are those of the owner, the only member of the business
 * Playwright creates; the accesses are the ones e2e/umzug-schichtplaner.spec.ts types in.
 */
const PORT = 28215;
const alsInhaber = <T extends { name?: unknown; firstName?: unknown; lastName?: unknown }>(
  satz: T,
  tom: boolean,
) => (tom ? { ...satz, name: "Jonas Weber", firstName: "Jonas", lastName: "Weber" } : satz);

const crewmeister = crewmeisterErsatz({
  email: "inhaber@weber.test",
  passwort: "crewmeister-e2e",
  daten: {
    ...ELBBLICK.crewmeister,
    members: ELBBLICK.crewmeister.members.map((m) => alsInhaber(m, m.userId === 501)),
  },
  seitengroesse: 2,
});
const papershift = papershiftErsatz({
  token: "papershift-e2e",
  daten: {
    ...ELBBLICK.papershift,
    users: ELBBLICK.papershift.users.map((u) => alsInhaber(u, u.id === 301)),
  },
});
const planday = plandayErsatz({
  appId: "planday-app",
  token: "planday-e2e",
  daten: {
    ...ELBBLICK.planday,
    employees: ELBBLICK.planday.employees.map((e) => alsInhaber(e, e.id === 1101)),
    deactivated: [],
  },
});

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  fetch: (anfrage) => {
    const pfad = new URL(anfrage.url).pathname;
    if (pfad.startsWith("/public_api/")) return papershift.fetch(anfrage);
    if (pfad.startsWith("/api/v3/")) return crewmeister.fetch(anfrage);
    return planday.fetch(anfrage);
  },
});
