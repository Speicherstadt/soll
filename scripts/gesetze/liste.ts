/*
 * The watch list: every norm Soll relies on, with its address on gesetze-im-internet.de and the
 * SHA-256 of its normalised text (scripts/gesetze/normen.json). An empty hash is "noch kein Stand":
 * the norm is watched from the first run that reached it.
 */
import { readFileSync } from "node:fs";
import { type Fundstelle, zitierweise } from "./zitate.ts";

export type Norm = {
  /** Key in the issue, e.g. `arbzg-3` */
  id: string;
  /** How it is cited, e.g. "§ 3 ArbZG" */
  norm: string;
  url: string;
  /** What Soll needs it for */
  zweck: string;
  /** SHA-256 of the normalised text; empty: no state yet */
  sha256: string;
};

export const NORMEN_DATEI = new URL("./normen.json", import.meta.url);

export const ladeNormen = (datei: URL = NORMEN_DATEI): Norm[] =>
  (JSON.parse(readFileSync(datei, "utf8")) as { normen: Norm[] }).normen;

/** Laws docs/regeln.md cites that gesetze-im-internet.de does not carry, so nothing can watch them */
export const NICHT_AUF_GII: Readonly<Record<string, string>> = {
  FeiertagsG:
    "Feiertagsgesetz Hamburg: Landesrecht, steht nicht auf gesetze-im-internet.de; die Feiertage rechnet packages/arbeitszeit nach den Gesetzen der Länder",
  FTG: "Feiertagsgesetz Brandenburg: Landesrecht, steht nicht auf gesetze-im-internet.de; die Feiertage rechnet packages/arbeitszeit nach den Gesetzen der Länder",
};

/** Cited paragraphs that are not watched, and laws that are neither watched nor left out with a reason */
export const fehlendeNormen = (
  zitiert: readonly Fundstelle[],
  normen: readonly Norm[],
): { fehlen: string[]; unbekannt: string[] } => {
  const beobachtet = new Set(normen.map((n) => n.norm));
  const gesetze = new Set(normen.map((n) => n.norm.split(" ").slice(2).join(" ")));
  const offen = zitiert.filter((f) => !(f.gesetz in NICHT_AUF_GII));
  return {
    fehlen: offen
      .filter((f) => gesetze.has(f.gesetz) && !beobachtet.has(zitierweise(f)))
      .map(zitierweise),
    unbekannt: [...new Set(offen.filter((f) => !gesetze.has(f.gesetz)).map((f) => f.gesetz))],
  };
};
