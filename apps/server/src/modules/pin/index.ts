import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { pins } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";

/** Wrong tries in a row after which a PIN is locked until the owner sets a new one (S-106) */
export const MAX_FEHLVERSUCHE = 5;

/** A PIN is 4 to 8 digits */
export const istPin = (pin: string): boolean => /^\d{4,8}$/.test(pin);

const pinVon = (db: Db, betriebId: string, nutzerId: string) =>
  db
    .select()
    .from(pins)
    .where(and(eq(pins.betriebId, betriebId), eq(pins.nutzerId, nutzerId)))
    .get();

/** Sets or replaces a PIN, stored as an Argon2id hash; a new PIN lifts a lock */
export const pinSetzen = async (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
  pin: string,
): Promise<void> => {
  const pinHash = await Bun.password.hash(pin, { algorithm: "argon2id" });
  const bisher = pinVon(db, kontext.betriebId, nutzerId);
  schreiben(schreibDb, kontext, (s) =>
    bisher
      ? s.aendern("pins", { nutzerId }, { pinHash, fehlversuche: 0, gesperrt: false })
      : s.einfuegen("pins", {
          betriebId: kontext.betriebId,
          nutzerId,
          pinHash,
          fehlversuche: 0,
          gesperrt: false,
        }),
  );
};

export type PinErgebnis = "ok" | "falsch" | "gesperrt" | "unbekannt";

/**
 * Checks a PIN. Each wrong try is counted in the audit chain; the fifth in a row locks the PIN, and a
 * locked PIN is not even compared any more.
 */
export const pinPruefen = async (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
  pin: string,
): Promise<PinErgebnis> => {
  const eintrag = pinVon(db, kontext.betriebId, nutzerId);
  if (!eintrag) return "unbekannt";
  if (eintrag.gesperrt) return "gesperrt";
  const richtig = await Bun.password.verify(pin, eintrag.pinHash);
  // Count inside the write transaction: it holds the write lock, so a parallel wrong try cannot be lost
  return schreiben(schreibDb, kontext, (s): PinErgebnis => {
    const aktuell = pinVon(db, kontext.betriebId, nutzerId);
    if (!aktuell || aktuell.pinHash !== eintrag.pinHash) return "unbekannt";
    if (aktuell.gesperrt) return "gesperrt";
    if (richtig) {
      if (aktuell.fehlversuche > 0) s.aendern("pins", { nutzerId }, { fehlversuche: 0 });
      return "ok";
    }
    const fehlversuche = aktuell.fehlversuche + 1;
    const gesperrt = fehlversuche >= MAX_FEHLVERSUCHE;
    s.aendern("pins", { nutzerId }, { fehlversuche, gesperrt });
    return gesperrt ? "gesperrt" : "falsch";
  });
};
