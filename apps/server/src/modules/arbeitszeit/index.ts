/** The module working time: models, assignments, stamps and the working day (S-303, S-304) */
export { monatAbgeschlossen } from "./abschluss.ts";
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
  type Aenderung,
  hatStempelungen,
  nachtragen,
  type Quelle,
  type Stempel,
  type StempelErgebnis,
  stempelAendern,
  stempelEntfernen,
  stempeln,
} from "./stempelungen.ts";
export { type TagAnsicht, tagLesen } from "./tag.ts";
export { modellAm, modellZuordnen, sollAm, type ZuordnungErgebnis } from "./zuordnungen.ts";
