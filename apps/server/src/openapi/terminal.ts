import * as karten from "../routes/karten.ts";
import * as kiosk from "../routes/kiosk.ts";
import * as pins from "../routes/pins.ts";
import * as terminals from "../routes/terminals.ts";
import type { Operation } from "./dokument.ts";
import { STATUS, unter } from "./module.ts";

/** The terminal (S-801, S-802): the owner's tablets, PINs, QR codes and NFC cards */
export const TERMINAL: readonly Operation[] = unter("/api/v1/terminal", "Terminal", [
  STATUS,
  {
    methode: "put",
    pfad: "/pins/:nutzerId",
    zusammenfassung: "Die PIN einer Person setzen (Inhaber), 6 bis 8 Ziffern, im Betrieb einmalig",
    koerper: pins.neuePinSchema,
  },
  {
    methode: "post",
    pfad: "/pins/:nutzerId/pruefen",
    zusammenfassung: "Eine PIN am Terminal prüfen (Gerät)",
    koerper: pins.pinSchema,
  },
  { methode: "get", pfad: "/geraete", zusammenfassung: "Die Tablets des Betriebs (Inhaber)" },
  {
    methode: "post",
    pfad: "/geraete",
    zusammenfassung: "Ein Tablet anlegen und seinen Kopplungscode erhalten (Inhaber)",
    koerper: terminals.kopplungSchema,
  },
  {
    methode: "delete",
    pfad: "/geraete/:terminalId",
    zusammenfassung: "Ein Tablet sofort widerrufen (Inhaber)",
  },
  {
    methode: "post",
    pfad: "/geraete/:terminalId/entsperren",
    zusammenfassung: "Die Sperre eines Tablets aufheben (Inhaber)",
  },
  {
    methode: "get",
    pfad: "/personen",
    zusammenfassung: "Wer am Terminal stempelt, mit PIN und QR-Code ja oder nein (Inhaber)",
  },
  {
    methode: "post",
    pfad: "/ausweise/:nutzerId",
    zusammenfassung: "Einen QR-Code für eine Person ausstellen, einmal angezeigt (Inhaber)",
  },
  {
    methode: "delete",
    pfad: "/ausweise/:nutzerId",
    zusammenfassung: "Den QR-Code einer Person entziehen (Inhaber)",
  },
  {
    methode: "get",
    pfad: "/karten",
    zusammenfassung:
      "Die NFC-Karten des Betriebs mit Person, Art und Datum, ohne UID und Schlüssel (Inhaber)",
  },
  {
    methode: "post",
    pfad: "/karten",
    zusammenfassung:
      "Eine NFC-Karte eintragen: einfache Karte mit UID oder NTAG 424 DNA mit UID und Schlüsseln (Inhaber)",
    koerper: karten.karteSchema,
  },
  {
    methode: "delete",
    pfad: "/karten/:karteId",
    zusammenfassung: "Eine NFC-Karte sofort entziehen, ihre Schlüssel werden gelöscht (Inhaber)",
  },
]);

/** The tablet's own API (S-801): with the device token from pairing, not a person's token */
export const KIOSK: readonly Operation[] = unter("/api/v1/kiosk", "Terminal", [
  {
    methode: "post",
    pfad: "/koppeln",
    zusammenfassung: "Ein Tablet mit dem Kopplungscode koppeln: gibt das Geräte-Token",
    koerper: kiosk.kopplungSchema,
    oeffentlich: true,
  },
  {
    methode: "get",
    pfad: "",
    zusammenfassung: "Name, Betrieb und Sperre des Tablets (Geräte-Token)",
  },
  {
    methode: "post",
    pfad: "/erkennen",
    zusammenfassung:
      "Eine Person per PIN, QR-Code, Karte mit PIN, SUN-Nachricht oder Beleg erkennen, mit ihrem Tag (Geräte-Token)",
    koerper: kiosk.ausweisSchema,
  },
  {
    methode: "post",
    pfad: "/stempeln",
    zusammenfassung: "Für eine erkannte Person stempeln (Geräte-Token)",
    koerper: kiosk.stempelSchema,
  },
]);
