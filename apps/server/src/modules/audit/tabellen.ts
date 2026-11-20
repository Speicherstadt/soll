import {
  arbeitszeitmodelle,
  bedarfe,
  betriebe,
  einladungen,
  geraete,
  korrekturen,
  kunden,
  mitgliedschaften,
  modellzuordnungen,
  monatsabschluesse,
  pins,
  projekte,
  schichten,
  schichtvorlagen,
  standorte,
  stempelungen,
  stundensaetze,
  taetigkeiten,
} from "../../db/schema.ts";

/**
 * The tables whose rows go through the audit chain, with the columns that name a row. A new table of
 * Soll is added here; a test fails for a table with `betrieb_id` that is missing.
 */
export const kettenTabellen = {
  betriebe: { tabelle: betriebe, schluessel: ["betriebId"] },
  mitgliedschaften: { tabelle: mitgliedschaften, schluessel: ["nutzerId"] },
  einladungen: { tabelle: einladungen, schluessel: ["einladungId"] },
  pins: { tabelle: pins, schluessel: ["nutzerId"] },
  standorte: { tabelle: standorte, schluessel: ["standortId"] },
  arbeitszeitmodelle: { tabelle: arbeitszeitmodelle, schluessel: ["modellId"] },
  modellzuordnungen: { tabelle: modellzuordnungen, schluessel: ["nutzerId", "gueltigAb"] },
  stempelungen: { tabelle: stempelungen, schluessel: ["stempelId"] },
  geraete: { tabelle: geraete, schluessel: ["geraetId"] },
  monatsabschluesse: { tabelle: monatsabschluesse, schluessel: ["abschlussId"] },
  korrekturen: { tabelle: korrekturen, schluessel: ["korrekturId"] },
  kunden: { tabelle: kunden, schluessel: ["kundeId"] },
  projekte: { tabelle: projekte, schluessel: ["projektId"] },
  taetigkeiten: { tabelle: taetigkeiten, schluessel: ["taetigkeitId"] },
  stundensaetze: { tabelle: stundensaetze, schluessel: ["satzId"] },
  schichtvorlagen: { tabelle: schichtvorlagen, schluessel: ["vorlageId"] },
  schichten: { tabelle: schichten, schluessel: ["schichtId"] },
  bedarfe: { tabelle: bedarfe, schluessel: ["bedarfId"] },
} as const;

export type TabellenName = keyof typeof kettenTabellen;
export type KettenTabelle<N extends TabellenName> = (typeof kettenTabellen)[N]["tabelle"];

/** The id of a row in a link: its key values, in the order of `schluessel` */
export const zeilenId = (name: TabellenName, zeile: Record<string, unknown>): string =>
  JSON.stringify(kettenTabellen[name].schluessel.map((spalte) => zeile[spalte]));
