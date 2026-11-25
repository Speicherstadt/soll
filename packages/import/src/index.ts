/** Parsers for the exports of other tools and for spreadsheets, pure functions (S-303, S-701 and later). */
export { type CsvZeile, csvZeilen, trennzeichenVon } from "./csv.ts";
export {
  CSV_ROLLEN,
  type CsvErgebnis,
  type CsvFehler,
  type CsvPerson,
  type CsvRolle,
  MAX_PERSONEN,
  mitarbeiterAusCsv,
} from "./mitarbeiter-csv.ts";
export {
  type ArtZuordnung,
  type Gelesen,
  type ImportAbwesenheit,
  type ImportDaten,
  type ImportKunde,
  type ImportProjekt,
  type ImportZeit,
  LESE_GRUENDE,
  type LeseFehler,
  type LeseGrund,
  leer,
  MAX_DATENSAETZE,
  MAX_TEXT,
} from "./modell.ts";
export { QUELLEN, type Quelle, quelleVon, SOLL_CSV_VORLAGE } from "./quellen.ts";
export { SOLL_CSV_FELDER, type SollCsvFeld, type Spaltenwahl, sollCsvLesen } from "./soll-csv.ts";
export { schluessel } from "./text.ts";
export { datumLesen, minutenLesen, uhrzeitLesen } from "./werte.ts";
export {
  artenAus,
  artVorschlag,
  type Mitglied,
  type Personenzuordnung,
  personenAus,
  personVorschlag,
  vorschlag,
  type Ziel,
  type Zuordnung,
} from "./zuordnung.ts";
