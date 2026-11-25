import { eingabeInBerlin } from "@soll/arbeitszeit";
import { type Context, Hono } from "hono";
import { WEBER_IN_KIMAI } from "./kimai-ersatz-daten.ts";
import { type Holen, MAX_ANTWORT } from "./modules/umzug/kimai-holen.ts";

/*
 * A stand-in for Kimai's REST API (CLAUDE.md: a stand-in for each import API built from its
 * documentation), built after Kimai's source (github.com/kimai/kimai 2.73.0): the endpoints and
 * filters of src/API/*Controller.php (`visible` 1, 2 or 3; `ignoreDates` for projects; `user=all`,
 * `begin`, `end`, `page`, `size`, `orderBy`, `order` for timesheets, a page past the last is 404),
 * the paging headers of src/API/ViewHandler.php, the bearer token of ApiRequestMatcher.php and the
 * old X-AUTH-USER/X-AUTH-TOKEN, which 2.73 refuses (TokenAuthenticator.php). Without the right to
 * see others, `/api/users` is 403 and `user=all` gives the token user's own timesheets only, as in
 * TimesheetController::cgetAction. Answers through `fetch`, no network.
 */

export { WEBER_IN_KIMAI };

export type KimaiDaten = {
  users: Record<string, unknown>[];
  customers: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  timesheets: Record<string, unknown>[];
};

/** A failure of the next calls: an HTTP status, a redirect, or a body that is no JSON */
export type KimaiStoerung = 401 | 403 | 429 | 500 | "weiter" | "kaputt";

export type Anfrage = { pfad: string; abfrage: URLSearchParams; kopf: Record<string, string> };

export type KimaiErsatzOptionen = {
  token: string;
  /** the user name an older Kimai takes with X-AUTH-USER; none: refused as in 2.73 */
  altesVerfahren?: { benutzer: string } | undefined;
  daten: KimaiDaten;
  /** the token's user may see everyone (`view_user`, `view_other_timesheet`) */
  alleSehen?: boolean;
  /** the largest page; small in tests, so paging is exercised */
  seitengroesse?: number;
};

/** The token's user: the first of the data, Kimai's admin */
const TOKEN_NUTZER = 1;

/** "2026-09-01T07:00:00+0200" as an instant */
const zeitpunkt = (wert: unknown): number =>
  typeof wert === "string" ? Date.parse(wert.replace(/([+-]\d\d)(\d\d)$/, "$1:$2")) : Number.NaN;

/** A filter's local date-time, read in the token user's zone (Europe/Berlin here) */
const filterZeit = (text: string | null): number | null => {
  const teile = text === null ? null : /^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d):\d\d$/.exec(text);
  return teile
    ? eingabeInBerlin(teile[1] as string, Number(teile[2]) * 60 + Number(teile[3]))
    : null;
};

const sichtbar = (saetze: readonly Record<string, unknown>[], wert: string | undefined) =>
  wert === "3" ? saetze : saetze.filter((s) => s.visible === (wert !== "2"));

const zeitbuchungen = (o: KimaiErsatzOptionen, abfrage: URLSearchParams) => {
  const von = filterZeit(abfrage.get("begin"));
  const bis = filterZeit(abfrage.get("end"));
  const alle = abfrage.get("user") === "all" && o.alleSehen !== false;
  return o.daten.timesheets
    .filter((t) => alle || t.user === TOKEN_NUTZER)
    .filter((t) => von === null || zeitpunkt(t.begin) >= von)
    .filter((t) => bis === null || zeitpunkt(t.begin) <= bis)
    .sort((a, b) => zeitpunkt(a.begin) - zeitpunkt(b.begin));
};

/** A page with Kimai's headers; a page past the last is 404 (TimesheetController `page`) */
const seite = (c: Context, liste: readonly unknown[], o: KimaiErsatzOptionen) => {
  const gewuenscht = Math.min(500, Number(c.req.query("size") ?? 50) || 50);
  const groesse = Math.min(gewuenscht, o.seitengroesse ?? 500);
  const nummer = Number(c.req.query("page") ?? 1);
  const seiten = Math.max(1, Math.ceil(liste.length / groesse));
  if (!Number.isInteger(nummer) || nummer < 1 || nummer > seiten)
    return c.json({ code: 404, message: "Not Found" }, 404);
  return c.json(liste.slice((nummer - 1) * groesse, nummer * groesse), 200, {
    "X-Page": String(nummer),
    "X-Total-Count": String(liste.length),
    "X-Total-Pages": String(seiten),
    "X-Per-Page": String(groesse),
  });
};

const angemeldet = (c: Context, o: KimaiErsatzOptionen): boolean => {
  if (c.req.header("authorization") === `Bearer ${o.token}`) return true;
  return (
    o.altesVerfahren !== undefined &&
    c.req.header("x-auth-user") === o.altesVerfahren.benutzer &&
    c.req.header("x-auth-token") === o.token
  );
};

const stoerungAntwort = (c: Context, stoerung: KimaiStoerung | undefined) => {
  if (stoerung === undefined) return null;
  if (stoerung === "weiter") return c.redirect("https://anderswo.test/login", 302);
  if (stoerung === "kaputt") return c.text("<html>Kimai</html>", 200);
  if (stoerung === 429)
    return c.json({ code: 429, message: "Too Many Requests" }, 429, { "Retry-After": "60" });
  return c.json({ code: stoerung, message: "Error" }, stoerung);
};

export const kimaiErsatz = (o: KimaiErsatzOptionen) => {
  const anfragen: Anfrage[] = [];
  const stoerungen: KimaiStoerung[] = [];
  const app = new Hono();
  app.use(async (c, next) => {
    const url = new URL(c.req.url);
    anfragen.push({ pfad: url.pathname, abfrage: url.searchParams, kopf: c.req.header() });
    const gestoert = stoerungAntwort(c, stoerungen.shift());
    if (gestoert) return gestoert;
    if (!angemeldet(c, o)) return c.json({ code: 401, message: "Invalid credentials" }, 401);
    await next();
  });
  app.get("/api/users", (c) =>
    o.alleSehen === false
      ? c.json({ code: 403, message: "Access denied." }, 403)
      : c.json(sichtbar(o.daten.users, c.req.query("visible"))),
  );
  app.get("/api/customers", (c) => c.json(sichtbar(o.daten.customers, c.req.query("visible"))));
  app.get("/api/projects", (c) => {
    const projekte = sichtbar(o.daten.projects, c.req.query("visible"));
    // without ignoreDates Kimai lists only projects running now
    const laufend = (p: Record<string, unknown>) => p.end === null || zeitpunkt(p.end) > Date.now();
    return c.json(c.req.query("ignoreDates") === "1" ? projekte : projekte.filter(laufend));
  });
  app.get("/api/activities", (c) => c.json(sichtbar(o.daten.activities, c.req.query("visible"))));
  app.get("/api/timesheets", (c) => seite(c, zeitbuchungen(o, new URL(c.req.url).searchParams), o));
  app.notFound((c) => c.json({ code: 404, message: "Not Found" }, 404));
  return {
    fetch: (anfrage: Request) => app.fetch(anfrage),
    anfragen,
    /** the next calls fail like this, one each */
    stoeren: (...folge: KimaiStoerung[]) => stoerungen.push(...folge),
  };
};

export type KimaiErsatz = ReturnType<typeof kimaiErsatz>;

/**
 * The connection of the server in Vitest: the stand-in answers instead of the network, with the
 * limits of the real one (no redirect, at most 10 MiB); the address is not resolved
 */
export const ersatzHolen =
  (antworten: (anfrage: Request) => Promise<Response> | Response): Holen =>
  async (url, kopf, _nurOeffentlich, koerper) => {
    let antwort: Response;
    try {
      const art = koerper === undefined ? {} : { method: "POST", body: koerper };
      antwort = await antworten(new Request(url, { headers: kopf, redirect: "manual", ...art }));
    } catch {
      return { ok: false, grund: "nicht_erreichbar" };
    }
    if (antwort.status >= 300 && antwort.status < 400) return { ok: false, grund: "weiterleitung" };
    const text = await antwort.text();
    if (text.length > MAX_ANTWORT) return { ok: false, grund: "zu_gross" };
    return {
      ok: true,
      wert: { status: antwort.status, kopf: (name) => antwort.headers.get(name), text },
    };
  };
