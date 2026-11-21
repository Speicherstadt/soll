import * as auslastung from "../routes/auslastung.ts";
import * as buchungen from "../routes/buchungen.ts";
import * as stoppuhr from "../routes/stoppuhr.ts";
import type { Operation } from "./dokument.ts";
import { unter } from "./module.ts";

/** Project time booked (S-602): the stopwatch and the bookings */
export const BUCHUNGEN: readonly Operation[] = unter("/api/v1/projektzeit", "Projektzeit", [
  {
    methode: "get",
    pfad: "/stoppuhr",
    zusammenfassung: "Die Stoppuhr und die Buchungen eines Tages, mit Hinweis bei mehr Projektzeit",
    abfrage: stoppuhr.tagSchema,
  },
  {
    methode: "post",
    pfad: "/stoppuhr/start",
    zusammenfassung: "Die Stoppuhr starten oder auf einen anderen Auftrag wechseln",
    koerper: stoppuhr.startSchema,
  },
  { methode: "post", pfad: "/stoppuhr/stopp", zusammenfassung: "Die laufende Stoppuhr anhalten" },
  {
    methode: "post",
    pfad: "/buchungen",
    zusammenfassung: "Eine Buchung nachtragen",
    koerper: buchungen.neuSchema,
  },
  {
    methode: "patch",
    pfad: "/buchungen/:buchungId",
    zusammenfassung: "Eine Buchung ändern, bis sie abgerechnet ist",
    koerper: buchungen.aenderungSchema,
  },
  {
    methode: "delete",
    pfad: "/buchungen/:buchungId",
    zusammenfassung: "Eine Buchung entfernen, bis sie abgerechnet ist",
  },
  {
    methode: "post",
    pfad: "/buchungen/abrechnen",
    zusammenfassung: "Buchungen als abgerechnet markieren (Inhaber, Planer)",
    koerper: buchungen.abrechnenSchema,
  },
]);

/** The utilisation of a past month (S-604); per person only while the business switched it on */
export const AUSLASTUNG: readonly Operation[] = unter("/api/v1/projektzeit", "Projektzeit", [
  {
    methode: "get",
    pfad: "/auslastung",
    zusammenfassung: "Die Auslastung des Teams in einem vergangenen Monat (Inhaber, Planer)",
    abfrage: auslastung.monatSchema,
  },
  {
    methode: "get",
    pfad: "/auslastung/personen",
    zusammenfassung: "Die Auslastung je Person, nur wenn der Betrieb sie eingeschaltet hat",
    abfrage: auslastung.monatSchema,
  },
  {
    methode: "get",
    pfad: "/auslastung/ich",
    zusammenfassung: "Die eigene Auslastung, nur wenn der Betrieb sie je Person eingeschaltet hat",
    abfrage: auslastung.monatSchema,
  },
  {
    methode: "put",
    pfad: "/auslastung/einstellung",
    zusammenfassung: "Die Auslastung je Person ein- oder ausschalten (Inhaber, § 87 BetrVG)",
    koerper: auslastung.einstellungSchema,
  },
]);
