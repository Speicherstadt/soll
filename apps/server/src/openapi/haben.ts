import * as haben from "../routes/haben.ts";
import type { Operation } from "./dokument.ts";
import { unter } from "./module.ts";

/** The link to Haben (S-606): access, contacts and the transfer of bookings as Leistungen */
export const HABEN: readonly Operation[] = unter("/api/v1/projektzeit/haben", "Projektzeit", [
  {
    methode: "get",
    pfad: "/zugang",
    zusammenfassung: "Adresse von Haben und ob ein Token hinterlegt ist (Inhaber, Planer)",
  },
  {
    methode: "put",
    pfad: "/zugang",
    zusammenfassung:
      "Adresse und API-Token von Haben hinterlegen; das Token wird verschlüsselt (Inhaber)",
    koerper: haben.zugangSchema,
  },
  {
    methode: "delete",
    pfad: "/zugang",
    zusammenfassung: "Den Zugang zu Haben entfernen (Inhaber)",
  },
  {
    methode: "get",
    pfad: "/kontakte",
    zusammenfassung: "Die Kontakte in Haben mit dem Kunden, mit dem jeder verbunden ist",
  },
  {
    methode: "post",
    pfad: "/kontakte/:kontaktId",
    zusammenfassung: "Einen Kontakt aus Haben mit einem Kunden verbinden oder als Kunden anlegen",
    koerper: haben.verbindenSchema,
  },
  {
    methode: "get",
    pfad: "/buchungen",
    zusammenfassung: "Die beendeten Buchungen eines Auftrags mit ihrem Stand gegenüber Haben",
    abfrage: haben.listeSchema,
  },
  {
    methode: "post",
    pfad: "/uebergabe",
    zusammenfassung: "Buchungen abrechnen und als Leistungen an Haben übergeben (wiederholbar)",
    koerper: haben.uebergabeSchema,
  },
]);
