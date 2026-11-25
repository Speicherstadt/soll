import { and, eq, isNull, max } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { karten } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { entschluesseln, verschluesseln } from "../geheim/index.ts";
import { kartenKennung, type TerminalSchluessel } from "./geheimnis.ts";
import { type Sun, sunPruefen } from "./sun.ts";

/** What the owner enters for a card (S-802): the UID, normalised, and for an NTAG 424 DNA its keys */
export type KartenEingabe =
  | { nutzerId: string; art: "uid"; uid: string }
  | { nutzerId: string; art: "ntag424"; uid: string; meta: string; datei: string };

export type Karte = typeof karten.$inferSelect;

/** The purpose of a card's encrypted keys: bound to business and card (geheim/index.ts) */
const zweck = (betriebId: string, karteId: string) => `karte:${betriebId}:${karteId}`;

/** The card in use with this lookup value; revoked cards with it may be there besides */
const aktiveKarteMitKennung = (db: Db, betriebId: string, kennung: string): Karte | undefined =>
  db
    .select()
    .from(karten)
    .where(
      and(
        eq(karten.betriebId, betriebId),
        eq(karten.uidKennung, kennung),
        isNull(karten.widerrufenAm),
      ),
    )
    .get();

/** The highest read counter any card of the business with this UID reached, or null */
const hoechsterZaehler = (db: Db, betriebId: string, kennung: string): number | null =>
  db
    .select({ zaehler: max(karten.zaehler) })
    .from(karten)
    .where(and(eq(karten.betriebId, betriebId), eq(karten.uidKennung, kennung)))
    .get()?.zaehler ?? null;

export const karteLesen = (db: Db, betriebId: string, karteId: string): Karte | undefined =>
  db
    .select()
    .from(karten)
    .where(and(eq(karten.betriebId, betriebId), eq(karten.karteId, karteId)))
    .get();

/**
 * Enters a card for a person. A UID another card in use holds is refused (`vergeben`). A UID
 * entered before and revoked becomes a new card with an id of its own, so the old card's links stay
 * with its person (Auskunft), but it starts from the read counter the UID reached: on the card the
 * counter never goes back either, so a SUN message read before the revocation stays used up. Both
 * are read inside the write transaction, which holds the write lock.
 */
export const karteEintragen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  schluessel: TerminalSchluessel,
  eingabe: KartenEingabe,
): { ok: true; karteId: string } | { ok: false; grund: "vergeben" } => {
  const kennung = kartenKennung(schluessel.karte, kontext.betriebId, eingabe.uid);
  const karteId = crypto.randomUUID();
  const werte = {
    betriebId: kontext.betriebId,
    karteId,
    nutzerId: eingabe.nutzerId,
    art: eingabe.art,
    uidKennung: kennung,
    schluessel:
      eingabe.art === "ntag424"
        ? verschluesseln(
            schluessel.spalten,
            zweck(kontext.betriebId, karteId),
            JSON.stringify({ meta: eingabe.meta, datei: eingabe.datei }),
          )
        : null,
    angelegtVon: kontext.akteur,
    angelegtAm: kontext.jetzt,
  };
  return schreiben(schreibDb, kontext, (s) => {
    if (aktiveKarteMitKennung(db, kontext.betriebId, kennung))
      return { ok: false as const, grund: "vergeben" as const };
    s.einfuegen("karten", { ...werte, zaehler: hoechsterZaehler(db, kontext.betriebId, kennung) });
    return { ok: true as const, karteId };
  });
};

/** Revokes a card: it stops at once, its keys are deleted, the row keeps the read counter */
export const karteEntziehen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  karteId: string,
): boolean => {
  const karte = karteLesen(db, kontext.betriebId, karteId);
  if (!karte || karte.widerrufenAm !== null) return false;
  schreiben(schreibDb, kontext, (s) =>
    s.aendern("karten", { karteId }, { widerrufenAm: kontext.jetzt, schluessel: null }),
  );
  return true;
};

/** The cards in use in a business, for the owner: no lookup value or key leaves the server */
export const kartenVon = (db: Db, betriebId: string) =>
  db
    .select({
      karteId: karten.karteId,
      nutzerId: karten.nutzerId,
      art: karten.art,
      angelegtAm: karten.angelegtAm,
    })
    .from(karten)
    .where(and(eq(karten.betriebId, betriebId), isNull(karten.widerrufenAm)))
    .all();

/** The card in use with this UID in the business, whatever its kind */
export const karteVonUid = (
  db: Db,
  schluessel: TerminalSchluessel,
  betriebId: string,
  uid: string,
): Karte | undefined =>
  aktiveKarteMitKennung(db, betriebId, kartenKennung(schluessel.karte, betriebId, uid));

const kartenSchluessel = (spalten: Uint8Array, karte: Karte) => {
  if (karte.schluessel === null) return undefined;
  const klartext = entschluesseln(spalten, zweck(karte.betriebId, karte.karteId), karte.schluessel);
  if (!klartext.ok) return undefined;
  const { meta, datei } = JSON.parse(klartext.wert) as { meta: string; datei: string };
  return { meta: Buffer.from(meta, "hex"), datei: Buffer.from(datei, "hex") };
};

/**
 * The NTAG 424 DNA of a business whose keys verify a SUN message, with the read counter in it. The
 * message does not say which card it is from (the UID is inside the encrypted PICCData), so each
 * card's keys are tried; a wrong key decrypts to noise that neither carries the PICCDataTag nor
 * the card's own UID, and the MAC still has to hold. The counter is compared by the caller.
 */
export const karteVonSun = (
  db: Db,
  schluessel: TerminalSchluessel,
  betriebId: string,
  sun: Sun,
): { karte: Karte; zaehler: number } | undefined => {
  const kandidaten = db
    .select()
    .from(karten)
    .where(
      and(eq(karten.betriebId, betriebId), eq(karten.art, "ntag424"), isNull(karten.widerrufenAm)),
    )
    .all();
  for (const karte of kandidaten) {
    const aes = kartenSchluessel(schluessel.spalten, karte);
    const ergebnis = aes ? sunPruefen(aes, sun) : { ok: false as const };
    if (
      ergebnis.ok &&
      kartenKennung(schluessel.karte, betriebId, ergebnis.uid) === karte.uidKennung
    )
      return { karte, zaehler: ergebnis.zaehler };
  }
  return undefined;
};
