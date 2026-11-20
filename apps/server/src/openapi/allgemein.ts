import * as auskunft from "../routes/auskunft.ts";
import * as betrieb from "../routes/betrieb.ts";
import * as einladungen from "../routes/einladungen.ts";
import * as einrichtung from "../routes/einrichtung.ts";
import * as pruefen from "../routes/pruefen.ts";
import * as standorte from "../routes/standorte.ts";
import * as zugaenge from "../routes/zugaenge.ts";
import type { Operation } from "./dokument.ts";

const V1 = "/api/v1";

/** The routes outside the modules: public ones, the business, its setup, invitations, tokens */
export const ALLGEMEIN: readonly Operation[] = [
  {
    methode: "get",
    pfad: `${V1}/openapi.json`,
    zusammenfassung: "Diese Beschreibung der API (OpenAPI 3.1)",
    bereich: "Öffentlich",
    oeffentlich: true,
  },
  {
    methode: "get",
    pfad: `${V1}/einladung/:token`,
    zusammenfassung: "Eine Einladung lesen: Betrieb, Name und Rolle",
    bereich: "Öffentlich",
    oeffentlich: true,
  },
  {
    methode: "post",
    pfad: `${V1}/einladung/:token/annehmen`,
    zusammenfassung: "Eine Einladung mit Benutzername und Passwort annehmen",
    bereich: "Öffentlich",
    koerper: einladungen.annehmenSchema,
    oeffentlich: true,
  },
  {
    methode: "post",
    pfad: `${V1}/pruefen`,
    zusammenfassung: "Einen Prüfwert von einem Stundenzettel prüfen",
    bereich: "Öffentlich",
    koerper: pruefen.pruefSchema,
    oeffentlich: true,
  },
  {
    methode: "get",
    pfad: `${V1}/betrieb`,
    zusammenfassung: "Der Betrieb des Aufrufs mit Rolle, Rechten und Modulen",
    bereich: "Betrieb",
  },
  {
    methode: "patch",
    pfad: `${V1}/betrieb/module`,
    zusammenfassung: "Module ein- und ausschalten (Inhaber)",
    bereich: "Betrieb",
    koerper: betrieb.moduleSchema,
  },
  {
    methode: "delete",
    pfad: `${V1}/betrieb/hinweis`,
    zusammenfassung: "Den Hinweis auf die eingeschaltete Arbeitszeit bestätigen (Inhaber)",
    bereich: "Betrieb",
  },
  {
    methode: "get",
    pfad: `${V1}/auskunft`,
    zusammenfassung: "Auskunft nach Art. 15 DSGVO als JSON",
    bereich: "Betrieb",
    abfrage: auskunft.abfrageSchema,
  },
  {
    methode: "put",
    pfad: `${V1}/einrichtung/betrieb`,
    zusammenfassung: "Angaben zum Betrieb in der Einrichtung",
    bereich: "Einrichtung",
    koerper: einrichtung.betriebSchema,
  },
  {
    methode: "post",
    pfad: `${V1}/einrichtung/abschliessen`,
    zusammenfassung: "Die Einrichtung abschließen",
    bereich: "Einrichtung",
  },
  {
    methode: "get",
    pfad: `${V1}/standorte`,
    zusammenfassung: "Die Standorte des Betriebs",
    bereich: "Einrichtung",
  },
  {
    methode: "post",
    pfad: `${V1}/standorte`,
    zusammenfassung: "Einen Standort anlegen",
    bereich: "Einrichtung",
    koerper: standorte.standortSchema,
  },
  {
    methode: "delete",
    pfad: `${V1}/standorte/:standortId`,
    zusammenfassung: "Einen Standort entfernen",
    bereich: "Einrichtung",
  },
  {
    methode: "post",
    pfad: `${V1}/einladungen`,
    zusammenfassung: "Eine Person per Link einladen",
    bereich: "Einrichtung",
    koerper: einladungen.einladenSchema,
  },
  {
    methode: "post",
    pfad: `${V1}/einladungen/liste`,
    zusammenfassung: "Eine Liste von Personen auf einmal einladen",
    bereich: "Einrichtung",
    koerper: einladungen.listeSchema,
  },
  {
    methode: "get",
    pfad: `${V1}/zugaenge`,
    zusammenfassung: "Die eigenen Zugänge zur API (nur mit Sitzung)",
    bereich: "Zugänge",
  },
  {
    methode: "post",
    pfad: `${V1}/zugaenge`,
    zusammenfassung:
      "Einen Zugang anlegen; das Token steht nur in dieser Antwort (nur mit Sitzung)",
    bereich: "Zugänge",
    koerper: zugaenge.zugangSchema,
  },
  {
    methode: "delete",
    pfad: `${V1}/zugaenge/:zugangId`,
    zusammenfassung: "Einen eigenen Zugang widerrufen (nur mit Sitzung)",
    bereich: "Zugänge",
  },
];
