import { nummernLuecken, type Offlineeintrag, stempelNachricht } from "@soll/arbeitszeit";
import { and, eq, isNotNull } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { geraete, stempelungen } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";

/**
 * The devices that stamp offline (S-305): each has a non-extractable ECDSA P-256 key pair made by
 * WebCrypto on the device; the server keeps the public key and checks every entry of the device's
 * queue against it (docs/plan.md, "Offline-Stempeln").
 */

/** A public key of P-256 as JWK; x and y are 32 bytes in base64url */
export type OeffentlicherSchluessel = { kty: "EC"; crv: "P-256"; x: string; y: string };

const ALGORITHMUS = { name: "ECDSA", namedCurve: "P-256" } as const;

/** One text for one key, whatever else the JWK carried (`ext`, `key_ops`) */
const kanonischerSchluessel = (schluessel: OeffentlicherSchluessel): string =>
  JSON.stringify({ crv: schluessel.crv, kty: schluessel.kty, x: schluessel.x, y: schluessel.y });

const importieren = (schluessel: OeffentlicherSchluessel): Promise<CryptoKey | null> =>
  crypto.subtle
    .importKey("jwk", JSON.parse(kanonischerSchluessel(schluessel)), ALGORITHMUS, false, ["verify"])
    .catch(() => null);

/**
 * The canonical text of a public key, or null when it is no key of P-256: one text for one key,
 * whatever else the JWK carried; also for the tablets of the terminal (S-803)
 */
export const schluesselPruefen = async (
  schluessel: OeffentlicherSchluessel,
): Promise<string | null> =>
  (await importieren(schluessel)) ? kanonischerSchluessel(schluessel) : null;

const bytesAus = (base64url: string): Uint8Array<ArrayBuffer> | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(base64url)) return null;
  return new Uint8Array(Buffer.from(base64url, "base64url"));
};

/**
 * Whether `signatur` (ECDSA P-256 with SHA-256, r and s as WebCrypto gives them, base64url) signs
 * `nachricht` under the stored key (`schluesselPruefen`)
 */
export const signaturGueltig = async (
  schluessel: string,
  nachricht: string,
  signatur: string,
): Promise<boolean> => {
  const oeffentlich = await importieren(JSON.parse(schluessel) as OeffentlicherSchluessel);
  const bytes = bytesAus(signatur);
  if (!oeffentlich || !bytes) return false;
  return crypto.subtle
    .verify(
      { name: "ECDSA", hash: "SHA-256" },
      oeffentlich,
      bytes,
      new TextEncoder().encode(nachricht),
    )
    .catch(() => false);
};

const geraetLesen = (db: Db, betriebId: string, geraetId: string) =>
  db
    .select()
    .from(geraete)
    .where(and(eq(geraete.betriebId, betriebId), eq(geraete.geraetId, geraetId)))
    .get();

export type AnmeldeErgebnis =
  | { ok: true; neu: boolean }
  | { ok: false; grund: "schluessel_ungueltig" | "vergeben" };

/**
 * Registers a device's public key for the person signed in. Again with the same key it changes
 * nothing; a device id that is taken by another key or another person is refused, so nobody takes
 * over a device whose entries are already checked against its key.
 */
export const geraetAnmelden = async (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: { geraetId: string; schluessel: OeffentlicherSchluessel },
): Promise<AnmeldeErgebnis> => {
  const schluessel = await schluesselPruefen(angaben.schluessel);
  if (!schluessel) return { ok: false, grund: "schluessel_ungueltig" };
  // synchronous from here: no other write comes between reading and inserting
  const vorhanden = geraetLesen(db, kontext.betriebId, angaben.geraetId);
  if (vorhanden)
    return vorhanden.nutzerId === kontext.akteur && vorhanden.schluessel === schluessel
      ? { ok: true, neu: false }
      : { ok: false, grund: "vergeben" };
  schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("geraete", {
      betriebId: kontext.betriebId,
      geraetId: angaben.geraetId,
      nutzerId: kontext.akteur,
      schluessel,
      angelegtAm: kontext.jetzt,
    }),
  );
  return { ok: true, neu: true };
};

export type SignaturErgebnis = { ok: true } | { ok: false; grund: "geraet_unbekannt" | "signatur" };

/**
 * Whether the entry was signed by a device of this person in this business: a device of another
 * person or business counts as unknown, so nothing tells whether it exists
 */
export const signaturPruefen = async (
  db: Db,
  betriebId: string,
  nutzerId: string,
  eintrag: Offlineeintrag,
  signatur: string,
): Promise<SignaturErgebnis> => {
  const geraet = geraetLesen(db, betriebId, eintrag.geraetId);
  if (!geraet || geraet.nutzerId !== nutzerId) return { ok: false, grund: "geraet_unbekannt" };
  const gueltig = await signaturGueltig(geraet.schluessel, stempelNachricht(eintrag), signatur);
  return gueltig ? { ok: true } : { ok: false, grund: "signatur" };
};

/** Numbers missing from a device of the person: from 1 to the highest number the server received */
export type GeraeteLuecke = { geraetId: string; von: number; bis: number };

/**
 * The gaps in the numbers of every device of a person. The originals count, not the versions in
 * force: an entry removed with a reason later still arrived.
 */
export const lueckenVon = (db: Db, betriebId: string, nutzerId: string): GeraeteLuecke[] => {
  const zeilen = db
    .select({ geraetId: stempelungen.geraetId, nummer: stempelungen.nummer })
    .from(stempelungen)
    .where(
      and(
        eq(stempelungen.betriebId, betriebId),
        eq(stempelungen.nutzerId, nutzerId),
        isNotNull(stempelungen.geraetId),
        isNotNull(stempelungen.nummer),
      ),
    )
    .all();
  const jeGeraet = Map.groupBy(zeilen, (zeile) => zeile.geraetId as string);
  return [...jeGeraet].flatMap(([geraetId, eintraege]) =>
    nummernLuecken(eintraege.map((eintrag) => eintrag.nummer as number)).map((luecke) => ({
      geraetId,
      ...luecke,
    })),
  );
};
