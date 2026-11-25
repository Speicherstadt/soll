import type { Context } from "hono";
import {
  type Datensaetze,
  ersatzApp,
  type Stoerung,
  tagVon,
  wann,
} from "./schichtplaner-ersatz.ts";

/*
 * A stand-in for Crewmeister's API v3 (BAULISTE.md S-706), after github.com/mztechnik/
 * hacs-crewmeister (api/client.py: `POST /api/v3/auth/user/` with `username` and `password`, a JWT
 * in `token`, a bearer on every call, 401 when refused) and github.com/HelpCode-ai/anythingmcp
 * (adapters/de/crewmeister.json: pages from 0, `pageSize` up to 100 and 20 by default, the page as
 * `content`, `totalElements`, `totalPages`, `hasNextPage`, RSQL in `filter` with `;` for AND).
 */

export type CrewmeisterDaten = {
  members: Datensaetze;
  absenceTypes: Datensaetze;
  workplaces: Datensaetze;
  shifts: Datensaetze;
  stamps: Datensaetze;
  absences: Datensaetze;
};

export type CrewmeisterErsatzOptionen = {
  email: string;
  passwort: string;
  daten: CrewmeisterDaten;
  /** the largest page; small in tests, so paging is exercised */
  seitengroesse?: number;
};

const PFADE: Record<string, keyof CrewmeisterDaten> = {
  "/api/v3/platform-app/members": "members",
  "/api/v3/absencemanager/absence-type-settings": "absenceTypes",
  "/api/v3/shiftplanner/workplaces": "workplaces",
  "/api/v3/shiftplanner/shifts": "shifts",
  "/api/v3/timetracking/stamps": "stamps",
  "/api/v3/absencemanager/absences": "absences",
};

/** One RSQL condition on a day or an instant (`from=ge=2026-09-01`); the stand-in knows no other */
const bedingung = (teil: string) => {
  const t = /^(\w+)=(ge|le|gt|lt)=(.+)$/.exec(teil);
  if (!t) return null;
  const [, feld = "", op, wert = ""] = t;
  const tag = /^\d{4}-\d\d-\d\d$/.test(wert);
  return (satz: Record<string, unknown>) => {
    const a = tag ? tagVon(satz[feld]) : wann(satz[feld]);
    const b = tag ? wert : wann(wert);
    if (op === "ge") return a >= b;
    if (op === "le") return a <= b;
    return op === "gt" ? a > b : a < b;
  };
};

/** The records under a filter, or null when the filter is not RSQL the stand-in reads (400) */
const gefiltert = (saetze: Datensaetze, filter: string | undefined): Datensaetze | null => {
  if (!filter) return saetze;
  const bedingungen = filter.split(";").map(bedingung);
  if (bedingungen.some((b) => b === null)) return null;
  return saetze.filter((s) => bedingungen.every((b) => b?.(s)));
};

const liste = (c: Context, o: CrewmeisterErsatzOptionen, art: keyof CrewmeisterDaten) => {
  const saetze = gefiltert(o.daten[art], c.req.query("filter"));
  if (saetze === null) return c.json({ errorCode: "INVALID_ARGUMENT" }, 400);
  const groesse = Math.min(
    Number(c.req.query("pageSize") ?? 20) || 20,
    100,
    o.seitengroesse ?? 100,
  );
  const seite = Number(c.req.query("page") ?? 0);
  const seiten = Math.ceil(saetze.length / groesse);
  return c.json({
    content: saetze.slice(seite * groesse, (seite + 1) * groesse),
    totalElements: saetze.length,
    totalPages: seiten,
    hasNextPage: seite + 1 < seiten,
  });
};

export const crewmeisterErsatz = (o: CrewmeisterErsatzOptionen) => {
  let stoerung: Stoerung | null = null;
  const anfragen: { pfad: string; abfrage: URLSearchParams; kopf: Record<string, string> }[] = [];
  const token = `cm.${btoa(o.email)}.e2e`;
  const app = ersatzApp(() => stoerung)
    .use(async (c, weiter) => {
      const url = new URL(c.req.url);
      anfragen.push({ pfad: url.pathname, abfrage: url.searchParams, kopf: c.req.header() });
      await weiter();
    })
    .post("/api/v3/auth/user/", async (c) => {
      const koerper = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      return koerper.username === o.email && koerper.password === o.passwort
        ? c.json({ token })
        : c.json({ errorCode: "UNAUTHENTICATED" }, 401);
    })
    .get("/api/v3/*", (c) => {
      if (c.req.header("authorization") !== `Bearer ${token}`)
        return c.json({ errorCode: "UNAUTHENTICATED" }, 401);
      const art = PFADE[new URL(c.req.url).pathname];
      return art ? liste(c, o, art) : c.json({ errorCode: "NOT_FOUND" }, 404);
    });
  return {
    fetch: (anfrage: Request) => app.fetch(anfrage),
    anfragen,
    stoeren: (wert: Stoerung | null) => {
      stoerung = wert;
    },
  };
};
