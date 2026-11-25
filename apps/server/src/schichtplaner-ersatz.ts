import { type Context, Hono } from "hono";

/*
 * What the stand-ins for the shift planners share (BAULISTE.md S-706; CLAUDE.md: a stand-in for
 * each import API built from its documentation): a failure the test sets for the next calls, and
 * records filtered by a day or an instant. Each tool's own stand-in (papershift-ersatz.ts,
 * planday-ersatz.ts, crewmeister-ersatz.ts) answers as its sources describe. Answers through
 * `fetch`, no network.
 */

/** A failure of the next calls: a status, a redirect, or a body that is no JSON */
export type Stoerung = 401 | 403 | 429 | 500 | "weiter" | "kaputt";

export type Datensaetze = Record<string, unknown>[];

/** The failure set, answered before anything else; null when none is set */
export const gestoert = (c: Context, stoerung: Stoerung | null) => {
  if (stoerung === null) return null;
  if (stoerung === "weiter") return c.redirect("https://example.test/", 302);
  if (stoerung === "kaputt") return c.text("<html>", 200);
  return c.json(
    { error: "failure" },
    stoerung,
    stoerung === 429 ? { "Retry-After": "30" } : undefined,
  );
};

/** A value of a record as an instant (ISO 8601 with offset) or a day; NaN when none */
export const wann = (wert: unknown): number => {
  if (typeof wert !== "string") return Number.NaN;
  return Date.parse(/^\d{4}-\d\d-\d\d$/.test(wert) ? `${wert}T00:00:00Z` : wert);
};

/** The day a record's value names, its first ten characters */
export const tagVon = (wert: unknown): string =>
  typeof wert === "string" ? wert.slice(0, 10) : "";

/** A Hono app with the failure the test sets, answered before every route */
export const ersatzApp = (stoerung: () => Stoerung | null) =>
  new Hono().use(async (c, weiter) => {
    const antwort = gestoert(c, stoerung());
    if (antwort) return antwort;
    await weiter();
  });
