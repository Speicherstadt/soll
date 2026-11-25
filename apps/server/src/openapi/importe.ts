import * as importe from "../routes/importe.ts";
import { abrufSchema } from "../routes/importe-abruf.ts";
import type { Operation } from "./dokument.ts";

const PFAD = "/api/v1/importe";

/** Imports from other tools (S-701, S-702, S-705): for the owner, in no module */
export const IMPORTE: readonly Operation[] = [
  {
    methode: "get",
    pfad: PFAD,
    zusammenfassung: "Die übernommenen Importe mit Werkzeug, Datei und Zahlen (Inhaber)",
    bereich: "Umzug",
  },
  {
    methode: "post",
    pfad: `${PFAD}/vorschau`,
    zusammenfassung:
      "Eine Datei lesen: Datensätze, Fehler mit Zeile, Vorschläge zur Zuordnung, Befunde (Inhaber)",
    bereich: "Umzug",
    koerper: importe.vorschauSchema,
  },
  {
    methode: "post",
    pfad: `${PFAD}/abruf`,
    zusammenfassung:
      "Daten über die API eines Werkzeugs abrufen (Clockodo, Kimai, Papershift, Planday, Crewmeister); der Zugang gilt nur für diesen Abruf, die Antwort ist eine Datei für Vorschau und Übernahme (Inhaber)",
    bereich: "Umzug",
    koerper: abrufSchema,
  },
  {
    methode: "post",
    pfad: `${PFAD}/probelauf`,
    zusammenfassung: "Was eine Übernahme anlegen würde, ohne zu schreiben (Inhaber)",
    bereich: "Umzug",
    koerper: importe.uebernahmeSchema,
  },
  {
    methode: "post",
    pfad: PFAD,
    zusammenfassung: "Eine Datei übernehmen; ein zweiter Lauf legt nichts doppelt an (Inhaber)",
    bereich: "Umzug",
    koerper: importe.uebernahmeSchema,
  },
  {
    methode: "get",
    pfad: `${PFAD}/vorlagen/:datei`,
    zusammenfassung:
      "Die Vorlage einer Tabelle von Zeiten, soll-zeiten.csv oder soll-zeiten.xlsx (Inhaber)",
    bereich: "Umzug",
    antwort: "datei",
  },
  {
    methode: "get",
    pfad: `${PFAD}/:importId/datei`,
    zusammenfassung: "Die Originaldatei eines Imports, geprüft gegen ihren SHA-256 (Inhaber)",
    bereich: "Umzug",
    antwort: "datei",
  },
];
