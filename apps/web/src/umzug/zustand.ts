import { plusMonate } from "@soll/arbeitszeit";
import type { Zuordnung } from "@soll/import";
import type { Datei, Vorschau } from "./typen.ts";

/*
 * The pure parts of the move page (S-701): the steps, the file in base64, the mapping Soll proposes
 * from a preview and the body of the dry run and the takeover
 */

export const SCHRITTE = ["werkzeug", "datei", "zuordnung", "vorschau", "uebernahme"] as const;
export type Schritt = (typeof SCHRITTE)[number];

/** base64 of a file's bytes, in pieces so a large file does not overflow the call stack */
export const base64Von = (bytes: Uint8Array): string => {
  let binaer = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binaer += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binaer);
};

/** Soll's proposal: members by name, kinds by word, every customer and order created anew */
export const zuordnungAus = (vorschau: Vorschau): Zuordnung => ({
  personen: Object.fromEntries(vorschau.personen.map((p) => [p.person, p.vorschlag])),
  arten: Object.fromEntries(vorschau.arten.map((a) => [a.art, a.vorschlag])),
  kunden: Object.fromEntries(vorschau.kunden.map((k) => [k.externalId, "neu" as const])),
  projekte: Object.fromEntries(vorschau.projekte.map((p) => [p.externalId, "neu" as const])),
});

/** The columns as the server takes them: each field with a header (a field without one is left out) */
export const spaltenwahl = (gewaehlt: Record<string, string | null>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(gewaehlt).filter((eintrag): eintrag is [string, string] => eintrag[1] !== null),
  );

/** The month before the running one: the latest the old tool may have closed */
export const letzterAbschliessbarer = (heute: string): string => plusMonate(heute.slice(0, 7), -1);

export type Auswahl = {
  quelle: string;
  datei: Datei;
  spalten: Record<string, string>;
  zuordnung: Zuordnung;
  abgeschlossenBis: string | null;
};

/** The body of POST /importe/probelauf and /importe */
export const koerperVon = (auswahl: Auswahl) => ({
  quelle: auswahl.quelle,
  datei: auswahl.datei,
  spalten: auswahl.spalten,
  zuordnung: auswahl.zuordnung,
  abgeschlossenBis: auswahl.abgeschlossenBis,
});
