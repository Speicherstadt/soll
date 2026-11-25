import { and, eq, isNull } from "drizzle-orm";
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

const karteMitKennung = (db: Db, betriebId: string, kennung: string): Karte | undefined =>
  db
    .select()
    .from(karten)
    .where(and(eq(karten.betriebId, betriebId), eq(karten.uidKennung, kennung)))
    .get();

export const karteLesen = (db: Db, betriebId: string, karteId: string): Karte | undefined =>
  db
    .select()
    .from(karten)
    .where(and(eq(karten.betriebId, betriebId), eq(karten.karteId, karteId)))
    .get();

/**
 * Enters a card for a person. A UID another card of the business holds is refused (`vergeben`); a
 * revoked card with the same UID is taken over with its read counter, which on the card never goes
 * back either, so a SUN message read before the revocation stays used up.
 */
export const karteEintragen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  schluessel: TerminalSchluessel,
  eingabe: KartenEingabe,
): { ok: true; karteId: string } | { ok: false; grund: "vergeben" } => {
  const kennung = kartenKennung(schluessel.karte, kontext.betriebId, eingabe.uid);
  const bisher = karteMitKennung(db, kontext.betriebId, kennung);
  if (bisher && bisher.widerrufenAm === null) return { ok: false, grund: "vergeben" };
  const karteId = bisher?.karteId ?? crypto.randomUUID();
  const werte = {
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
    widerrufenAm: null,
    angelegtVon: kontext.akteur,
    angelegtAm: kontext.jetzt,
  };
  schreiben(schreibDb, kontext, (s) =>
    bisher
      ? s.aendern("karten", { karteId }, werte)
      : s.einfuegen("karten", { betriebId: kontext.betriebId, karteId, ...werte }),
  );
  return { ok: true, karteId };
};

/**
 * Revokes a card: it stops at once, the row keeps the read counter. Its keys are deleted from the
 * row and from the stored contents of every link that wrote it (each holds the row with its keys);
 * the links stay, so the chain still verifies (docs/plan.md, "Schlüssel entzogener Karten").
 */
export const karteEntziehen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  karteId: string,
): boolean => {
  const karte = karteLesen(db, kontext.betriebId, karteId);
  if (!karte || karte.widerrufenAm !== null) return false;
  schreiben(schreibDb, kontext, (s) => {
    if (karte.schluessel !== null) s.inhalteEntfernen("karten", { karteId });
    s.aendern("karten", { karteId }, { widerrufenAm: kontext.jetzt, schluessel: null });
  });
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
): Karte | undefined => {
  const karte = karteMitKennung(db, betriebId, kartenKennung(schluessel.karte, betriebId, uid));
  return karte && karte.widerrufenAm === null ? karte : undefined;
};

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
