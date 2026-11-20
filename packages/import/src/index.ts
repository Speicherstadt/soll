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
