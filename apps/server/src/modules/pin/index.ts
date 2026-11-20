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

/** Two PINs alike in one business at once: the unique index lets only the first through */
const doppelt = (fehler: unknown): boolean =>
  /UNIQUE constraint failed: pins\.betrieb_id, pins\.pin_kennung/.test(String(fehler));

/**
 * Sets or replaces a PIN, stored as an Argon2id hash and as the keyed hash by which the terminal
 * finds the person (`kennung`, S-801); a new PIN lifts a lock. A PIN another member of the business
 * holds is refused (`vergeben`): the terminal recognises a person by the PIN alone.
 */
export const pinSetzen = async (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
  pin: { pin: string; kennung: string },
): Promise<"ok" | "vergeben"> => {
  const andere = personVonPin(db, kontext.betriebId, pin.kennung, { auchGesperrt: true });
  if (andere !== undefined && andere !== nutzerId) return "vergeben";
  const pinHash = await Bun.password.hash(pin.pin, { algorithm: "argon2id" });
  const werte = { pinHash, pinKennung: pin.kennung, fehlversuche: 0, gesperrt: false };
  const bisher = pinVon(db, kontext.betriebId, nutzerId);
  try {
    schreiben(schreibDb, kontext, (s) =>
      bisher
        ? s.aendern("pins", { nutzerId }, werte)
        : s.einfuegen("pins", { betriebId: kontext.betriebId, nutzerId, ...werte }),
    );
  } catch (fehler) {
    if (doppelt(fehler)) return "vergeben";
    throw fehler;
  }
  return "ok";
};

/**
 * The person of a PIN in a business by its keyed hash (S-801); a locked PIN counts at the terminal
 * only once the owner set a new one
 */
export const personVonPin = (
  db: Db,
  betriebId: string,
  kennung: string,
  optionen: { auchGesperrt?: boolean } = {},
): string | undefined => {
  const zeile = db
    .select({ nutzerId: pins.nutzerId, gesperrt: pins.gesperrt })
    .from(pins)
    .where(and(eq(pins.betriebId, betriebId), eq(pins.pinKennung, kennung)))
    .get();
  if (!zeile || (zeile.gesperrt && !optionen.auchGesperrt)) return undefined;
  return zeile.nutzerId;
};

/** Who in a business has a PIN the terminal can find, for the owner's list */
export const mitPin = (db: Db, betriebId: string): Set<string> =>
  new Set(
    db
      .select({ nutzerId: pins.nutzerId, kennung: pins.pinKennung, gesperrt: pins.gesperrt })
      .from(pins)
      .where(eq(pins.betriebId, betriebId))
      .all()
      .filter((zeile) => zeile.kennung !== null && !zeile.gesperrt)
      .map((zeile) => zeile.nutzerId),
  );

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
