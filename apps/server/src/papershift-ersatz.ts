import type { Context } from "hono";
import { type Datensaetze, ersatzApp, type Stoerung, tagVon } from "./schichtplaner-ersatz.ts";

/*
 * A stand-in for Papershift's public API v1 (BAULISTE.md S-706), after Papershift's own
 * github.com/Papershift/hosted_pages_template (`api_token` as a parameter, 401 for a wrong one),
 * github.com/toasternet-gmbh/ai-integration-hub (the 401 body `{"response": "API Key not
 * found!"}`), github.com/maluramichael/papershift-cli (`next_page`) and github.com/HelpCode-ai/
 * anythingmcp (adapters/de/papershift.json: 25 per page from 1, `interface_language` on every
 * request, `range_start` and `range_end` as days, the rows under the resource's name).
 */

export type PapershiftDaten = {
  users: Datensaetze;
  absenceTypes: Datensaetze;
  workingSessions: Datensaetze;
  absences: Datensaetze;
};

export type PapershiftErsatzOptionen = {
  token: string;
  daten: PapershiftDaten;
  /** the page; Papershift's 25 unless a test makes it small */
  seitengroesse?: number;
};

/** Path, the key of the rows, the data and whether it is filtered by the range */
const LISTEN: Record<string, [string, keyof PapershiftDaten, "beginn" | "ueberlappt" | null]> = {
  "/users": ["users", "users", null],
  "/absence_types": ["absence_types", "absenceTypes", null],
  "/working_sessions": ["working_sessions", "workingSessions", "beginn"],
  "/absences": ["absences", "absences", "ueberlappt"],
};

const imZeitraum = (c: Context, satz: Record<string, unknown>, art: "beginn" | "ueberlappt") => {
  const von = c.req.query("range_start") ?? "0000-01-01";
  const bis = c.req.query("range_end") ?? "9999-12-31";
  const beginn = tagVon(satz.starts_at);
  return art === "beginn"
    ? beginn >= von && beginn <= bis
    : beginn <= bis && tagVon(satz.ends_at) >= von;
};

export const papershiftErsatz = (o: PapershiftErsatzOptionen) => {
  let stoerung: Stoerung | null = null;
  const anfragen: URL[] = [];
  const groesse = o.seitengroesse ?? 25;
  const app = ersatzApp(() => stoerung).get("/public_api/v1/*", (c) => {
    const url = new URL(c.req.url);
    anfragen.push(url);
    if (c.req.query("api_token") !== o.token)
      return c.json({ response: "API Key not found!" }, 401);
    if (!c.req.query("interface_language")) return c.json({ error: "interface_language" }, 400);
    const liste = LISTEN[url.pathname.replace("/public_api/v1", "")];
    if (!liste) return c.json({ error: "not found" }, 404);
    const [schluessel, art, filter] = liste;
    const saetze = o.daten[art].filter((s) => filter === null || imZeitraum(c, s, filter));
    const seite = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
    const weiter = seite * groesse < saetze.length;
    const naechste = new URL(url);
    naechste.searchParams.set("page", String(seite + 1));
    naechste.searchParams.delete("api_token");
    return c.json({
      [schluessel]: saetze.slice((seite - 1) * groesse, seite * groesse),
      next_page: weiter ? naechste.href : null,
    });
  });
  return {
    fetch: (anfrage: Request) => app.fetch(anfrage),
    anfragen,
    stoeren: (wert: Stoerung | null) => {
      stoerung = wert;
    },
  };
};
