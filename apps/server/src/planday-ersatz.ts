import type { Context } from "hono";
import { type Datensaetze, ersatzApp, type Stoerung, tagVon } from "./schichtplaner-ersatz.ts";

/*
 * A stand-in for Planday's Open API and its token endpoint (BAULISTE.md S-706), after
 * github.com/borgels/mcp-server-planday (src/planday/client.ts: `POST /connect/token` as a form with
 * `client_id`, `grant_type=refresh_token`, `refresh_token`, 400 for a refused token; the access
 * token as a bearer with the app id in `X-ClientId`; resources.ts: `data` and `paging` with
 * `offset`, `limit` up to 50 and `total`) and github.com/mindcloud-inc/universal-api-reference
 * (apis/p/planday: the paths and filters `From`/`To`, `from`/`to`, `startDate`/`endDate`,
 * `Offset`/`Limit` for shifts and absence requests). One stand-in serves both hosts.
 */

export type PlandayDaten = {
  employees: Datensaetze;
  deactivated: Datensaetze;
  positions: Datensaetze;
  shifts: Datensaetze;
  punchClock: Datensaetze;
  breaks: Record<string, Datensaetze>;
  absenceRequests: Datensaetze;
};

export type PlandayErsatzOptionen = {
  appId: string;
  token: string;
  daten: PlandayDaten;
  /** the largest page; small in tests, so paging is exercised */
  seitengroesse?: number;
};

type Filter = (c: Context, satz: Record<string, unknown>) => boolean;

/** Whether a record's local start (or a range's) lies in the filter's days */
const zwischen =
  (von: string, bis: string, feld: string): Filter =>
  (c, satz) => {
    const tag = tagVon(satz[feld]);
    return tag >= (c.req.query(von) ?? "0000") && tag <= (c.req.query(bis) ?? "9999");
  };

const ueberlappt: Filter = (c, satz) => {
  const zeitraum = (satz.absencePeriod ?? {}) as Record<string, unknown>;
  return (
    tagVon(zeitraum.start) <= (c.req.query("endDate") ?? "9999") &&
    tagVon(zeitraum.end) >= (c.req.query("startDate") ?? "0000")
  );
};

const LISTEN: Record<string, [keyof PlandayDaten, Filter | null]> = {
  "/hr/v1.0/employees": ["employees", null],
  "/hr/v1.0/employees/deactivated": ["deactivated", null],
  "/scheduling/v1.0/positions": ["positions", null],
  "/scheduling/v1.0/shifts": ["shifts", zwischen("From", "To", "startDateTime")],
  "/punchclock/v1.0/punchclockshifts": ["punchClock", zwischen("from", "to", "startDateTime")],
  "/absence/v1.0/absencerequests": ["absenceRequests", ueberlappt],
};

const seite = (c: Context, saetze: readonly unknown[], groesste: number) => {
  const offset = Number(c.req.query("offset") ?? c.req.query("Offset") ?? 0) || 0;
  const limit = Math.min(Number(c.req.query("limit") ?? c.req.query("Limit") ?? 50) || 50, 50);
  const groesse = Math.min(limit, groesste);
  return c.json({
    data: saetze.slice(offset, offset + groesse),
    paging: { offset, limit: groesse, total: saetze.length },
  });
};

export const plandayErsatz = (o: PlandayErsatzOptionen) => {
  let stoerung: Stoerung | null = null;
  const anfragen: URL[] = [];
  const zugriff = `pd-access-${o.appId}`;
  const app = ersatzApp(() => stoerung)
    .post("/connect/token", async (c) => {
      const form = new URLSearchParams(await c.req.text());
      return form.get("client_id") === o.appId &&
        form.get("grant_type") === "refresh_token" &&
        form.get("refresh_token") === o.token
        ? c.json({ access_token: zugriff, token_type: "Bearer", expires_in: 3600 })
        : c.json({ error: "invalid_grant" }, 400);
    })
    .get("/*", (c) => {
      const url = new URL(c.req.url);
      anfragen.push(url);
      if (
        c.req.header("authorization") !== `Bearer ${zugriff}` ||
        c.req.header("x-clientid") !== o.appId
      )
        return c.json({ message: "Unauthorized" }, 401);
      const pause = /^\/punchclock\/v1\.0\/punchclockshifts\/(\d+)\/breaks$/.exec(url.pathname);
      if (pause) return c.json({ data: o.daten.breaks[pause[1] as string] ?? [] });
      const liste = LISTEN[url.pathname];
      if (!liste) return c.json({ message: "Not found" }, 404);
      const [art, filter] = liste;
      const saetze = (o.daten[art] as Datensaetze).filter((s) => filter === null || filter(c, s));
      return seite(c, saetze, o.seitengroesse ?? 50);
    });
  return {
    fetch: (anfrage: Request) => app.fetch(anfrage),
    anfragen,
    stoeren: (wert: Stoerung | null) => {
      stoerung = wert;
    },
  };
};
