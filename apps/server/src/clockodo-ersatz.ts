import { Hono } from "hono";

/*
 * A stand-in for Clockodo's REST API (CLAUDE.md: a stand-in for each import API built from its
 * documentation), built after the public SDK `clockodo` (https://github.com/peerigon/clockodo):
 * the endpoints of src/clockodo.ts (`/v3/users`, `/v3/customers`, `/v4/projects`, `/v4/services`,
 * `/v2/entries` with `time_since` and `time_until`, `/v4/absences` with `filter[year][]`), the
 * headers of src/lib/api.ts and src/lib/requests.ts (API user and key, the application with a
 * contact of at most 50 characters), paging as in src/lib/api.ts (`paging.count_pages`, `page`) in
 * the snake_case the API sends (src/lib/mappings.ts). Answers through `fetch`, no network.
 */

export type ClockodoDaten = {
  users: Record<string, unknown>[];
  customers: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  services: Record<string, unknown>[];
  entries: Record<string, unknown>[];
  absences: Record<string, unknown>[];
};

/** A failure of the next calls: an HTTP status, with `Retry-After` for 429, or no answer at all */
export type ClockodoStoerung = 401 | 429 | 500 | "netz" | "kaputt";

export type Anfrage = { pfad: string; abfrage: string; kopf: Record<string, string> };

/** At most 50 characters "name;email" (SDK src/lib/api.ts, EXTERNAL_APPLICATION_HEADER_MAX_LENGTH) */
const MAX_ANWENDUNG = 50;

const seite = <T>(liste: readonly T[], nummer: number, groesse: number) => ({
  paging: {
    items_per_page: groesse,
    current_page: nummer,
    count_pages: Math.max(1, Math.ceil(liste.length / groesse)),
    count_items: liste.length,
  },
  liste: liste.slice((nummer - 1) * groesse, nummer * groesse),
});

export const clockodoErsatz = (optionen: {
  nutzer: string;
  schluessel: string;
  daten: ClockodoDaten;
  /** records per page; small in tests, so paging is exercised */
  seitengroesse?: number;
}) => {
  const groesse = optionen.seitengroesse ?? 100;
  const anfragen: Anfrage[] = [];
  const stoerungen: ClockodoStoerung[] = [];
  const app = new Hono();

  app.use(async (c, next) => {
    const url = new URL(c.req.url);
    anfragen.push({ pfad: url.pathname, abfrage: url.search, kopf: c.req.header() });
    const stoerung = stoerungen.shift();
    if (stoerung === 429)
      return c.json({ error: { message: "Too many requests" } }, 429, { "Retry-After": "60" });
    if (stoerung === 401 || stoerung === 500)
      return c.json({ error: { message: "Error" } }, stoerung);
    if (stoerung === "kaputt") return c.text("<html>", 200);
    const anwendung = c.req.header("x-clockodo-external-application") ?? "";
    if (!/^[^;]+;.+@.+$/.test(anwendung) || anwendung.length > MAX_ANWENDUNG)
      return c.json({ error: { message: "Client identification missing" } }, 400);
    if (
      c.req.header("x-clockodoapiuser") !== optionen.nutzer ||
      c.req.header("x-clockodoapikey") !== optionen.schluessel
    )
      return c.json({ error: { message: "Authentication failed" } }, 401);
    await next();
  });

  const liste = (
    feld: "data" | "entries",
    saetze: readonly unknown[],
    nummer: string | undefined,
  ) => {
    const { paging, liste: teil } = seite(saetze, Number(nummer ?? 1), groesse);
    return { paging, [feld]: teil };
  };

  const stamm = (pfad: string, daten: () => readonly unknown[]) =>
    app.get(pfad, (c) => c.json(liste("data", daten(), c.req.query("page"))));
  stamm("/api/v3/users", () => optionen.daten.users);
  stamm("/api/v3/customers", () => optionen.daten.customers);
  stamm("/api/v4/projects", () => optionen.daten.projects);
  stamm("/api/v4/services", () => optionen.daten.services);

  app.get("/api/v2/entries", (c) => {
    const von = c.req.query("time_since");
    const bis = c.req.query("time_until");
    // SDK src/lib/requiredParams.ts: GET_ENTRIES needs timeSince and timeUntil
    if (!von || !bis)
      return c.json({ error: { message: "Missing time_since or time_until" } }, 400);
    const saetze = optionen.daten.entries.filter(
      (e) => String(e.time_since) >= von && String(e.time_since) < bis,
    );
    return c.json({ filter: null, ...liste("entries", saetze, c.req.query("page")) });
  });

  app.get("/api/v4/absences", (c) => {
    const jahre = c.req.queries("filter[year][]") ?? [];
    const saetze = optionen.daten.absences.filter((a) =>
      jahre.includes(String(a.date_since).slice(0, 4)),
    );
    // SDK AbsencesReturnType: `{ data }` without paging
    return c.json({ data: saetze });
  });

  return {
    fetch: (anfrage: Request) => {
      if (stoerungen[0] === "netz") {
        stoerungen.shift();
        return Promise.reject(new TypeError("fetch failed"));
      }
      return Promise.resolve(app.fetch(anfrage));
    },
    anfragen,
    stoeren: (...naechste: ClockodoStoerung[]) => stoerungen.push(...naechste),
  };
};

/**
 * Weber Haustechnik in Clockodo, September 2026: Jonas (the owner) and Sandra, two customers, a
 * project, two services, a day of two touching entries, a day with a break between two entries, a
 * week of leave and a sick day
 */
export const WEBER_IN_CLOCKODO: ClockodoDaten = {
  users: [
    {
      id: 11,
      name: "Jonas Weber",
      number: "1",
      email: "jonas@weber-haustechnik.test",
      role: "owner",
      active: true,
    },
    {
      id: 12,
      name: "Sandra Kühn",
      number: "2",
      email: "sandra@weber-haustechnik.test",
      role: "worker",
      active: true,
    },
  ],
  customers: [
    { id: 201, name: "Elbhof Immobilien", number: "K-1001", active: true, note: "Tor 3" },
    { id: 202, name: "Bäckerei Hansen", number: null, active: true },
  ],
  projects: [
    {
      id: 301,
      customers_id: 201,
      name: "Bad Elbhof",
      number: "A-17",
      active: true,
      completed: false,
    },
  ],
  services: [
    { id: 401, name: "Montage", number: "M", active: true },
    { id: 402, name: "Fahrt", number: null, active: true },
  ],
  entries: [
    {
      id: 1001,
      users_id: 11,
      customers_id: 201,
      projects_id: 301,
      services_id: 401,
      type: 1,
      time_since: "2026-09-01T05:00:00Z",
      time_until: "2026-09-01T09:00:00Z",
      duration: 14400,
      clocked: true,
      hourly_rate: 60,
    },
    {
      id: 1002,
      users_id: 11,
      customers_id: 201,
      projects_id: 301,
      services_id: 402,
      type: 1,
      time_since: "2026-09-01T09:00:00Z",
      time_until: "2026-09-01T13:30:00Z",
      duration: 16200,
      clocked: true,
      text: "Rohre verlegt",
    },
    {
      id: 1003,
      users_id: 11,
      customers_id: 202,
      projects_id: null,
      services_id: 401,
      type: 1,
      time_since: "2026-09-02T05:00:00Z",
      time_until: "2026-09-02T09:00:00Z",
      duration: 14400,
      clocked: false,
    },
    {
      id: 1004,
      users_id: 11,
      customers_id: 202,
      projects_id: null,
      services_id: 401,
      type: 1,
      time_since: "2026-09-02T09:30:00Z",
      time_until: "2026-09-02T13:30:00Z",
      duration: 14400,
      clocked: false,
    },
    {
      id: 1005,
      users_id: 12,
      customers_id: 202,
      projects_id: null,
      services_id: 401,
      type: 1,
      time_since: "2026-09-03T05:00:00Z",
      time_until: "2026-09-03T13:00:00Z",
      duration: 28800,
      clocked: true,
    },
    {
      id: 1006,
      users_id: 11,
      customers_id: 202,
      projects_id: null,
      services_id: 401,
      type: 2,
      time_since: "2026-09-03T05:00:00Z",
      time_until: "2026-09-03T05:00:00Z",
      lumpsum: 45.5,
    },
  ],
  absences: [
    {
      id: 501,
      users_id: 11,
      date_since: "2026-09-07",
      date_until: "2026-09-11",
      status: 1,
      type: 1,
      count_days: 5,
      count_hours: null,
      note: "Ostsee",
    },
    {
      id: 502,
      users_id: 11,
      date_since: "2026-09-14",
      date_until: "2026-09-14",
      status: 1,
      type: 4,
      count_days: 1,
      count_hours: null,
      sick_note: true,
    },
    {
      id: 503,
      users_id: 11,
      date_since: "2026-09-21",
      date_until: "2026-09-21",
      status: 0,
      type: 1,
      count_days: 1,
      count_hours: null,
    },
  ],
};
