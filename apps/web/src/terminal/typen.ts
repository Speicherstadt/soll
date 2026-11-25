import type { Tag, Tagesstand } from "@soll/arbeitszeit";

/** What the tablet keeps of its pairing (POST /api/v1/kiosk/koppeln) */
export type Kopplung = { token: string; terminalId: string; name: string; betrieb: string };

/** GET /api/v1/kiosk */
export type KioskStand = {
  terminalId: string;
  name: string;
  betrieb: string;
  gesperrtBis: number | null;
};

/**
 * What identifies a person: the PIN alone, the value of a QR code, a card's UID with the PIN, the
 * SUN message of an NTAG 424 DNA or the receipt the server gave for one (S-802)
 */
export type Ausweis =
  | { pin: string }
  | { qr: string }
  | { karte: string; pin: string }
  | { sun: { e: string; c: string } }
  | { beleg: string };

/** A person recognised and their running day (POST /api/v1/kiosk/erkennen) */
export type Erkannt = {
  person: { nutzerId: string; name: string };
  tag: { tag: Tag; jetzt: number; sollMinuten: number | null; stand: Tagesstand } | null;
  /** after a SUN message: what to stamp with, as the message itself counts only once */
  beleg?: string;
};

/** POST /api/v1/kiosk/stempeln */
export type Gestempelt = Erkannt & { stempel: { art: string; zeitpunkt: number } };

/** Why the server did not recognise anyone: how many tries are left, or until when it is locked */
export type Abgelehnt = { art: "unbekannt"; rest: number } | { art: "gesperrt"; bis: number };
