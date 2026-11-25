/*
 * The file a fetch from a shift planner becomes (BAULISTE.md S-706: Papershift, Planday,
 * Crewmeister). Each tool's answers are first turned into the same flat records by a pure function
 * per tool (papershift.ts, planday.ts, crewmeister.ts); this file holds exactly those records as
 * JSON Lines, a head line naming the tool and the period, then one record per line, so a finding
 * names its line (as Clockodo's and Kimai's, S-703, S-705). No e-mail, no note, no wage: only what
 * Soll reads. Sorted by kind and id, so the same data gives the same file and the same SHA-256.
 */

export const SCHICHTPLANER_FORMAT = "soll-schichtplaner-api";
export const SCHICHTPLANER_VERSION = 1;

/**
 * An instant: UTC milliseconds; a text the tool wrote that names no instant (a local time the
 * clocks skip or pass twice) stays as written, so the reader refuses it with its line; null for an
 * end that is not there yet
 */
export type Zeitpunkt = number | string | null;

/** A person of the tool by its id, with the name it shows */
export type PersonSatz = { kind: "person"; id: string; name: string };

/** A planned shift; `person` null for an open one, `break` in minutes, `role` as the tool names it */
export type SchichtSatz = {
  kind: "shift";
  id: string;
  person: string | null;
  begin: Zeitpunkt;
  end: Zeitpunkt;
  break: number;
  role: string;
};

/** A piece of work as stamped: from a begin to an end without a break in between */
export type ArbeitSatz = {
  kind: "work";
  id: string;
  person: string;
  begin: Zeitpunkt;
  end: Zeitpunkt;
};

/**
 * An absence from `from` to `to` (days), its kind as the tool names it; the first or the last day
 * only half; `part_day` when it covers a part of a day the halves cannot name (hours)
 */
export type AbwesenheitSatz = {
  kind: "absence";
  id: string;
  person: string;
  type: string;
  from: string;
  to: string;
  first_half: boolean;
  last_half: boolean;
  approved: boolean;
  part_day: boolean;
};

export type SchichtplanerSatz = PersonSatz | SchichtSatz | ArbeitSatz | AbwesenheitSatz;

export const SCHICHTPLANER_ARTEN = ["person", "shift", "work", "absence"] as const;

/** What a fetch made of a tool's answers: the tool, the period and the records */
export type SchichtplanerAbzug = {
  werkzeug: string;
  von: string;
  bis: string;
  saetze: readonly SchichtplanerSatz[];
};

const ISO = (ms: number): string => new Date(ms).toISOString().replace(".000Z", "Z");

const alsText = (wert: Zeitpunkt): string | null => (typeof wert === "number" ? ISO(wert) : wert);

/** A record as written: instants as ISO 8601 in UTC */
const geschrieben = (satz: SchichtplanerSatz): Record<string, unknown> =>
  satz.kind === "shift" || satz.kind === "work"
    ? { ...satz, begin: alsText(satz.begin), end: alsText(satz.end) }
    : satz;

/** Ids in order as numbers ("9" before "10"), a piece "<id>/<n>" after its record */
const idFolge = (a: string, b: string): number => {
  const [x = "", y = ""] = [a.split("/"), b.split("/")].map((teile) =>
    teile.map((teil) => teil.padStart(20, "0")).join("/"),
  );
  return x < y ? -1 : x > y ? 1 : 0;
};

const folge = (a: SchichtplanerSatz, b: SchichtplanerSatz): number =>
  SCHICHTPLANER_ARTEN.indexOf(a.kind) - SCHICHTPLANER_ARTEN.indexOf(b.kind) || idFolge(a.id, b.id);

/** The text of the file: the head line, then the records by kind and id, each line ending in LF */
export const schichtplanerAbzugText = (abzug: SchichtplanerAbzug): string => {
  const kopf = {
    format: SCHICHTPLANER_FORMAT,
    version: SCHICHTPLANER_VERSION,
    tool: abzug.werkzeug,
    from: abzug.von,
    to: abzug.bis,
  };
  const zeilen = [...abzug.saetze].sort(folge).map(geschrieben);
  return [kopf, ...zeilen].map((zeile) => `${JSON.stringify(zeile)}\n`).join("");
};
