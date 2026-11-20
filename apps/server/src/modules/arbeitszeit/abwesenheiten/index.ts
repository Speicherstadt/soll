/** Absences (S-401): part of the module working time (docs/plan.md, "Module") */
export {
  antragMelden,
  entscheidungMelden,
  krankheitMelden,
} from "./benachrichtigen.ts";
export {
  type AbwesenheitZeile,
  abwesenheitenIn,
  abwesenheitLesen,
  type Status,
} from "./lesen.ts";
export { type GeplanteSchicht, ohnePlan, type Schichtquelle } from "./plan.ts";
export {
  type AbwesenheitErgebnis,
  type AbwesenheitFehler,
  type Antrag,
  beantragen,
  bescheinigungSetzen,
  type Entscheidung,
  entscheiden,
  type Krankmeldung,
  krankheitBeenden,
  krankMelden,
  type Rechte,
} from "./schreiben.ts";
export {
  bescheinigungAbTagVon,
  bescheinigungVon,
  type Erinnerung,
  erinnerungenVon,
  kinderkrankstand,
  type Urlaubsstand,
  urlaubsstand,
  urlaubstageVon,
} from "./stand.ts";
