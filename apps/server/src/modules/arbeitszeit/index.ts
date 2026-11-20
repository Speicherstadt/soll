/**
 * The module working time: models, assignments, stamps, the working day and closing a month
 * (S-303, S-304, S-306)
 */
export { monatAbgeschlossen } from "./abschluss.ts";
export { type GegeneintragErgebnis, gegeneintragAnlegen } from "./gegeneintraege.ts";
export {
  type EntfernenErgebnis,
  type Modell,
  modellAnlegen,
  modellEntfernen,
  modelleLesen,
  modellLesen,
  type NeuesModell,
} from "./modelle.ts";
export {
  type AbschlussFehler,
  type MonatStatus,
  monatAbschliessen,
  monatBestaetigen,
  monatStatus,
  type SchrittErgebnis,
} from "./monatsabschluss.ts";
export { type Pruefung, pruefwertEinesMonats } from "./pruefseite.ts";
export {
  type Aenderung,
  aenderungenIn,
  hatStempelungen,
  nachtragen,
  type Quelle,
  type Stempel,
  type StempelErgebnis,
  stempelAendern,
  stempelEntfernen,
  stempeln,
} from "./stempelungen.ts";
export { stundenzettelAus } from "./stundenzettel.ts";
export { type TagAnsicht, tagLesen } from "./tag.ts";
export { modellAm, modellZuordnen, sollAm, type ZuordnungErgebnis } from "./zuordnungen.ts";
