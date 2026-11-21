import * as datev from "../routes/datev.ts";
import * as erinnerungen from "../routes/erinnerungen.ts";
import * as modelle from "../routes/modelle.ts";
import * as monat from "../routes/monat.ts";
import * as offline from "../routes/offline.ts";
import * as pruefexport from "../routes/pruefexport.ts";
import * as zeiten from "../routes/zeiten.ts";
import type { Operation } from "./dokument.ts";

const AZ = "/api/v1/arbeitszeit";
const bereich = "Arbeitszeit";

type Kurz = Omit<Operation, "bereich" | "pfad"> & { pfad: string };

/** The module working time: stamps, days, months, models, reminders, DATEV, audit export */
export const ARBEITSZEIT: readonly Operation[] = (
  [
    { methode: "get", pfad: "/status", zusammenfassung: "Ob das Modul eingeschaltet ist" },
    {
      methode: "get",
      pfad: "/tag",
      zusammenfassung: "Ein Tag einer Person: Stempelungen, Ist, Befunde mit Paragraf",
      abfrage: zeiten.tagSchema,
    },
    {
      methode: "post",
      pfad: "/stempelungen",
      zusammenfassung: "Jetzt stempeln (Kommen, Gehen, Pause)",
      koerper: zeiten.stempelSchema,
    },
    {
      methode: "post",
      pfad: "/stempelungen/offline",
      zusammenfassung: "Eine signierte Stempelung aus der Warteschlange eines Geräts",
      koerper: offline.offlineSchema,
    },
    {
      methode: "post",
      pfad: "/stempelungen/nachtrag",
      zusammenfassung: "Eine Stempelung mit Grund nachtragen",
      koerper: zeiten.nachtragSchema,
    },
    {
      methode: "patch",
      pfad: "/stempelungen/:stempelId",
      zusammenfassung: "Eine Stempelung mit Grund ändern",
      koerper: zeiten.aenderungSchema,
    },
    {
      methode: "post",
      pfad: "/stempelungen/:stempelId/entfernen",
      zusammenfassung: "Eine Stempelung mit Grund entfernen",
      koerper: zeiten.entfernenSchema,
    },
    {
      methode: "put",
      pfad: "/geraete/:geraetId",
      zusammenfassung: "Den Schlüssel eines Geräts für die Warteschlange anmelden",
      koerper: offline.anmeldeSchema,
    },
    {
      methode: "get",
      pfad: "/personen",
      zusammenfassung: "Die Personen, die stempeln, mit ihrem Modell heute",
    },
    {
      methode: "put",
      pfad: "/personen/:nutzerId/modell",
      zusammenfassung: "Einer Person ein Arbeitszeitmodell zuordnen",
      koerper: zeiten.zuordnungSchema,
    },
    { methode: "get", pfad: "/modelle", zusammenfassung: "Die Arbeitszeitmodelle" },
    {
      methode: "post",
      pfad: "/modelle",
      zusammenfassung: "Ein Arbeitszeitmodell anlegen",
      koerper: modelle.modellSchema,
    },
    {
      methode: "delete",
      pfad: "/modelle/:modellId",
      zusammenfassung: "Ein Arbeitszeitmodell entfernen",
    },
    {
      methode: "get",
      pfad: "/monat",
      zusammenfassung: "Ein Monat einer Person mit Konto, Befunden und Stand des Abschlusses",
      abfrage: monat.lesenSchema,
    },
    {
      methode: "get",
      pfad: "/monat/stundenzettel",
      zusammenfassung: "Der Stundenzettel eines Monats als PDF",
      abfrage: monat.lesenSchema,
      antwort: "pdf",
    },
    {
      methode: "post",
      pfad: "/monat/bestaetigen",
      zusammenfassung: "Den eigenen Monat bestätigen",
      koerper: monat.bestaetigenSchema,
    },
    {
      methode: "post",
      pfad: "/monat/abschliessen",
      zusammenfassung: "Den Monat einer Person abschließen (Inhaber)",
      koerper: monat.abschliessenSchema,
    },
    {
      methode: "post",
      pfad: "/monat/gegeneintrag",
      zusammenfassung: "Einen Gegeneintrag in einem abgeschlossenen Monat buchen",
      koerper: monat.gegeneintragSchema,
    },
    {
      methode: "get",
      pfad: "/pruefexport",
      zusammenfassung: "Der Prüfexport eines Zeitraums als CSV oder PDF",
      abfrage: pruefexport.abfrageSchema,
      antwort: "csv",
    },
    {
      methode: "get",
      pfad: "/erinnerungen",
      zusammenfassung: "Erinnerungen: eigene Wünsche, Zeiten des Betriebs",
    },
    {
      methode: "put",
      pfad: "/erinnerungen/wuensche",
      zusammenfassung: "Welche Erinnerungen die Person bekommt",
      koerper: erinnerungen.wuenscheSchema,
    },
    {
      methode: "put",
      pfad: "/erinnerungen/regeln",
      zusammenfassung: "Die Zeiten der Erinnerungen im Betrieb (Inhaber)",
      koerper: erinnerungen.regelnSchema,
    },
    {
      methode: "post",
      pfad: "/erinnerungen/abos",
      zusammenfassung: "Ein Gerät für Web Push anmelden",
      koerper: erinnerungen.aboSchema,
    },
    {
      methode: "delete",
      pfad: "/erinnerungen/abos",
      zusammenfassung: "Ein Gerät von Web Push abmelden",
      koerper: erinnerungen.abmeldenSchema,
    },
    { methode: "get", pfad: "/datev", zusammenfassung: "Die Zuordnung für den DATEV-Lohn-Export" },
    {
      methode: "put",
      pfad: "/datev",
      zusammenfassung: "Berater, Mandant, Lohnarten und Personalnummern für DATEV",
      koerper: datev.einstellungenSchema,
    },
    {
      methode: "get",
      pfad: "/datev/export",
      zusammenfassung: "Die Bewegungsdaten eines Monats als DATEV-ASCII-Datei",
      abfrage: datev.exportSchema,
      antwort: "text",
    },
  ] satisfies Kurz[]
).map((op) => ({ ...op, pfad: `${AZ}${op.pfad}`, bereich }));
