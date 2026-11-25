/** Parsers for the exports of other tools and for spreadsheets, pure functions (S-303, S-701 and later). */
export {
  ABWESENHEITSTYPEN,
  ABZUG_ARTEN,
  ABZUG_FELDER,
  ABZUG_FORMAT,
  type Abzug,
  type AbzugArt,
  abzugText,
  clockodoLesen,
} from "./clockodo/index.ts";
export { type CsvZeile, csvZeilen, trennzeichenVon } from "./csv.ts";
export {
  KIMAI_ARTEN,
  KIMAI_FELDER,
  KIMAI_FORMAT,
  type KimaiAbzug,
  type KimaiArt,
  kimaiAbzugText,
  kimaiLesen,
} from "./kimai/index.ts";
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
  type ImportBuchung,
  type ImportDaten,
  type ImportKunde,
  type ImportProjekt,
  type ImportSchicht,
  type ImportTaetigkeit,
  type ImportZeit,
  LESE_GRUENDE,
  type LeseFehler,
  type LeseGrund,
  leer,
  MAX_DATENSAETZE,
  MAX_TEXT,
} from "./modell.ts";
export { QUELLEN, type Quelle, quelleVon, SOLL_CSV_VORLAGE } from "./quellen.ts";
export { type CrewmeisterAntworten, crewmeisterAbzug } from "./schichtplaner/crewmeister.ts";
export {
  SCHICHTPLANER_FORMAT,
  type SchichtplanerAbzug,
  schichtplanerAbzugText,
  schichtplanerLesen,
} from "./schichtplaner/index.ts";
export { type PapershiftAntworten, papershiftAbzug } from "./schichtplaner/papershift.ts";
export { type PlandayAntworten, plandayAbzug } from "./schichtplaner/planday.ts";
export { SOLL_CSV_FELDER, type SollCsvFeld, type Spaltenwahl, sollCsvLesen } from "./soll-csv.ts";
export { tabelleLesen } from "./tabelle.ts";
export { dauerFrei, pauseFrei, tagFrei, uhrzeitFrei } from "./tabelle-werte.ts";
export { inhaltsKennung, TABELLE_FELDER, type TabelleFeld } from "./tabelle-zeile.ts";
export { schluessel, textAusBytes } from "./text.ts";
export { TABELLE_VORLAGE_CSV, tabelleVorlageXlsx } from "./vorlage.ts";
export { WERKZEUGE, type Werkzeug } from "./werkzeuge.ts";
export { datumLesen, minutenLesen, uhrzeitLesen } from "./werte.ts";
export { MAX_ENTPACKT, xlsxLesen } from "./xlsx.ts";
export { xlsxSchreiben, type Zelle } from "./xlsx-schreiben.ts";
export {
  artenAus,
  artVorschlag,
  type Buchungszuordnung,
  type Kandidat,
  kandidatVorschlag,
  type Mitglied,
  type Personenzuordnung,
  personenAus,
  personVorschlag,
  vorschlag,
  type Ziel,
  type Zuordnung,
  zeitProjekteAus,
  zeitTaetigkeitenAus,
} from "./zuordnung.ts";
