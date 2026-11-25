import * as verfahrensdoku from "../routes/verfahrensdoku.ts";
import type { Operation } from "./dokument.ts";

const VD = "/api/v1/verfahrensdoku";
const bereich = "Verfahrensdokumentation";

/** The Verfahrensdokumentation of the business (S-902), for the owner only */
export const VERFAHRENSDOKU: readonly Operation[] = [
  {
    methode: "get",
    pfad: VD,
    zusammenfassung: "Die Verfahrensdokumentation aus dem Stand des Betriebs und seine Angaben",
    bereich,
  },
  {
    methode: "get",
    pfad: `${VD}/datei`,
    zusammenfassung: "Die Verfahrensdokumentation als PDF oder Markdown",
    bereich,
    abfrage: verfahrensdoku.dateiSchema,
    antwort: "pdf",
  },
  {
    methode: "put",
    pfad: `${VD}/angaben`,
    zusammenfassung: "Die Angaben des Betriebs und seine eigenen Abschnitte speichern",
    bereich,
    koerper: verfahrensdoku.angabenSchema,
  },
];
