import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { ausweise } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { tokenHash, zufallsToken } from "./geheimnis.ts";

/** What the QR code holds: a prefix, so the terminal knows Soll's codes, and the token */
export const AUSWEIS_PRAEFIX = "soll-ausweis:";

const ausweisVon = (db: Db, betriebId: string, nutzerId: string) =>
  db
    .select()
    .from(ausweise)
    .where(and(eq(ausweise.betriebId, betriebId), eq(ausweise.nutzerId, nutzerId)))
    .get();

/**
 * Issues a person's QR code, replacing the one before (S-801). The value is shown once, for
 * printing; the server keeps its SHA-256 only, so a lost card is replaced, not printed again.
 */
export const ausweisAusstellen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
): string => {
  const token = zufallsToken();
  const werte = {
    tokenHash: tokenHash(token),
    ausgestelltVon: kontext.akteur,
    ausgestelltAm: kontext.jetzt,
  };
  const bisher = ausweisVon(db, kontext.betriebId, nutzerId);
  schreiben(schreibDb, kontext, (s) =>
    bisher
      ? s.aendern("ausweise", { nutzerId }, werte)
      : s.einfuegen("ausweise", { betriebId: kontext.betriebId, nutzerId, ...werte }),
  );
  return `${AUSWEIS_PRAEFIX}${token}`;
};

export const ausweisEntziehen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
): boolean => {
  if (!ausweisVon(db, kontext.betriebId, nutzerId)) return false;
  schreiben(schreibDb, kontext, (s) => s.loeschen("ausweise", { nutzerId }));
  return true;
};

/** The person of a QR code in the business, or undefined for any other value */
export const personVonAusweis = (db: Db, betriebId: string, wert: string): string | undefined => {
  if (!wert.startsWith(AUSWEIS_PRAEFIX)) return undefined;
  return db
    .select({ nutzerId: ausweise.nutzerId })
    .from(ausweise)
    .where(
      and(
        eq(ausweise.betriebId, betriebId),
        eq(ausweise.tokenHash, tokenHash(wert.slice(AUSWEIS_PRAEFIX.length))),
      ),
    )
    .get()?.nutzerId;
};

/** Who in a business holds a QR code, for the owner's list */
export const mitAusweis = (db: Db, betriebId: string): Set<string> =>
  new Set(
    db
      .select({ nutzerId: ausweise.nutzerId })
      .from(ausweise)
      .where(eq(ausweise.betriebId, betriebId))
      .all()
      .map((zeile) => zeile.nutzerId),
  );
