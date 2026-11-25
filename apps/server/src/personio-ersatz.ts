import { type Context, Hono } from "hono";
import { type PersonioDaten, WEBER_IN_PERSONIO } from "./personio-ersatz-daten.ts";

/*
 * A stand-in for Personio's API v2 (CLAUDE.md: a stand-in for each import API built from its
 * documentation): the token and its revocation after credentials-service-api-v2 (a form with
 * `grant_type=client_credentials`, wrong credentials 400 `invalid_client`, the token as a bearer
 * for 24 h), the lists after persons-service-api-v2 (`limit` up to 50, `_data` and
 * `_meta.links.next.href` with an opaque cursor that keeps the filters) and the v2 clients for
 * periods (`limit` up to 100, `start.date_time.gte`/`.lte`, `starts_from.date_time.lte`,
 * `ends_at.date_time.gte`). Without a scope a list is 403. Answers through `fetch`, no network.
 */

export { WEBER_IN_PERSONIO };

/** A failure of the next calls: a status, a redirect, a body that is no JSON, a bad next link */
export type PersonioStoerung = 401 | 403 | 429 | 500 | "weiter" | "kaputt" | "schleife" | "fremd";

export type Anfrage = { methode: string; pfad: string; abfrage: URLSearchParams; koerper: string };

export type PersonioErsatzOptionen = {
  clientId: string;
  clientSecret: string;
  daten: PersonioDaten;
  /** the lists the integration may read; all when missing */
  rechte?: readonly ("persons" | "absences" | "attendances")[];
  /** the largest page; small in tests, so paging is exercised */
  seitengroesse?: number;
};

const LISTEN = {
  "/v2/persons": { recht: "persons", groesste: 50 },
  "/v2/absence-types": { recht: "absences", groesste: 50 },
  "/v2/attendance-periods": { recht: "attendances", groesste: 100 },
  "/v2/absence-periods": { recht: "absences", groesste: 100 },
} as const;
type Pfad = keyof typeof LISTEN;

const problem = (c: Context, status: 400 | 401 | 403 | 404 | 500, titel: string) =>
  c.json(
    { personio_trace_id: "baaaaaad-c0de-fade-baad-c000000000de", errors: [{ title: titel }] },
    status,
  );

/** A local date-time of a record, its first 19 characters ("2026-09-01T07:00:00") */
const ort = (satz: Record<string, unknown>, feld: string): string | null => {
  const wert = (satz[feld] as { date_time?: unknown } | null)?.date_time;
  return typeof wert === "string" ? wert.slice(0, 19) : null;
};

const imBereich = (wert: string | null, ab: string | null, bis: string | null) =>
  wert !== null && (ab === null || wert >= ab) && (bis === null || wert <= bis);

/** The records of a list under its filters */
const auswahl = (daten: PersonioDaten, pfad: Pfad, filter: URLSearchParams) => {
  if (pfad === "/v2/persons") return daten.persons;
  if (pfad === "/v2/absence-types") return daten.absenceTypes;
  if (pfad === "/v2/attendance-periods")
    return daten.attendancePeriods.filter((p) =>
      imBereich(
        ort(p, "start"),
        filter.get("start.date_time.gte"),
        filter.get("start.date_time.lte"),
      ),
    );
  return daten.absencePeriods.filter(
    (p) =>
      imBereich(ort(p, "starts_from"), null, filter.get("starts_from.date_time.lte")) &&
      (p.ends_at === null ||
        imBereich(ort(p, "ends_at"), filter.get("ends_at.date_time.gte"), null)),
  );
};

/** An opaque cursor that carries the filters and the offset, as some of Personio's v2 cursors do */
const cursorText = (filter: URLSearchParams, ab: number) =>
  `cur_${Buffer.from(JSON.stringify({ f: filter.toString(), ab })).toString("base64url")}`;
const cursorLesen = (text: string): { filter: URLSearchParams; ab: number } | null => {
  try {
    const wert = JSON.parse(Buffer.from(text.slice(4), "base64url").toString("utf8"));
    return { filter: new URLSearchParams(wert.f), ab: Number(wert.ab) };
  } catch {
    return null;
  }
};

export const personioErsatz = (o: PersonioErsatzOptionen) => {
  const anfragen: Anfrage[] = [];
  const stoerungen: PersonioStoerung[] = [];
  const tokens = new Set<string>();
  const app = new Hono();
  const naechsteStoerung = () => stoerungen.shift();

  app.use(async (c, next) => {
    const url = new URL(c.req.url);
    const koerper = c.req.method === "POST" ? await c.req.raw.clone().text() : "";
    anfragen.push({
      methode: c.req.method,
      pfad: url.pathname,
      abfrage: url.searchParams,
      koerper,
    });
    await next();
  });
  app.post("/v2/auth/token", async (c) => {
    if (!c.req.header("content-type")?.startsWith("application/x-www-form-urlencoded"))
      return c.json({ error: "invalid_request" }, 400);
    const form = new URLSearchParams(await c.req.text());
    if (form.get("grant_type") !== "client_credentials")
      return c.json({ error: "unsupported_grant_type" }, 400);
    if (form.get("client_id") !== o.clientId || form.get("client_secret") !== o.clientSecret)
      return c.json(
        { error: "invalid_client", error_description: "Client authentication failed" },
        400,
      );
    const token = `papi-${crypto.randomUUID()}`;
    tokens.add(token);
    return c.json({ access_token: token, expires_in: 86400, token_type: "Bearer", scope: "" });
  });
  app.post("/v2/auth/revoke", async (c) => {
    tokens.delete(new URLSearchParams(await c.req.text()).get("token") ?? "");
    return c.body(null, 200);
  });
  app.get("/v2/:liste", (c) => {
    const pfad = new URL(c.req.url).pathname as Pfad;
    const liste = LISTEN[pfad];
    if (!liste) return problem(c, 404, "Not Found");
    const stoerung = naechsteStoerung();
    if (stoerung === "weiter") return c.redirect("https://anderswo.test/login", 302);
    if (stoerung === "kaputt") return c.text("<html>Personio</html>", 200);
    if (stoerung === 429) return c.json({}, 429, { "Retry-After": "60" });
    if (typeof stoerung === "number") return problem(c, stoerung, "Error");
    const token = c.req.header("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!tokens.has(token)) return problem(c, 401, "Unauthorized");
    if (o.rechte && !o.rechte.includes(liste.recht)) return problem(c, 403, "Forbidden");
    const abfrage = new URL(c.req.url).searchParams;
    const cursor = abfrage.get("cursor");
    const stand = cursor === null ? { filter: abfrage, ab: 0 } : cursorLesen(cursor);
    if (stand === null) return problem(c, 400, "Invalid cursor");
    const groesse = Math.min(
      Number(stand.filter.get("limit") ?? 10) || 10,
      liste.groesste,
      o.seitengroesse ?? liste.groesste,
    );
    const alle = auswahl(o.daten, pfad, stand.filter);
    const seite = alle.slice(stand.ab, stand.ab + groesse);
    const origin = new URL(c.req.url).origin;
    const weiter =
      stoerung === "schleife"
        ? c.req.url
        : stoerung === "fremd"
          ? `https://anderswo.test${pfad}?cursor=x`
          : stand.ab + groesse < alle.length
            ? `${origin}${pfad}?cursor=${cursorText(stand.filter, stand.ab + groesse)}`
            : null;
    return c.json({
      _data: seite,
      _meta: {
        links: { self: { href: c.req.url }, ...(weiter ? { next: { href: weiter } } : {}) },
      },
    });
  });
  app.notFound((c) => problem(c, 404, "Not Found"));
  return {
    fetch: (anfrage: Request) => app.fetch(anfrage),
    anfragen,
    /** tokens handed out and not revoked */
    offeneTokens: () => tokens.size,
    /** the next calls of a list fail like this, one each */
    stoeren: (...folge: PersonioStoerung[]) => stoerungen.push(...folge),
  };
};

export type PersonioErsatz = ReturnType<typeof personioErsatz>;
