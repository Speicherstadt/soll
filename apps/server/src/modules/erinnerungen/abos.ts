import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { pushAbos } from "../../db/schema.ts";
import { sha256 } from "../audit/hash.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { entschluesseln, verschluesseln } from "../geheim/index.ts";
import { type Abo, gueltigerPunkt } from "./webpush.ts";

/*
 * The devices of a person that receive Web Push (S-307). The subscription is a capability: whoever
 * holds endpoint and auth can send to the device, so it is stored encrypted (CLAUDE.md, "Secrets").
 */

const ZWECK = "push_abos";

export type GespeichertesAbo = { aboId: string; abo: Abo; sprache: string };

/** p256dh a point on P-256 and auth 16 bytes (RFC 8291, Sections 2.1 and 7) */
export const aboGueltig = (abo: Abo): boolean =>
  gueltigerPunkt(new Uint8Array(Buffer.from(abo.p256dh, "base64url"))) &&
  Buffer.from(abo.auth, "base64url").length === 16;

const nachEndpunkt = (db: Db, betriebId: string, endpoint: string) =>
  db
    .select()
    .from(pushAbos)
    .where(and(eq(pushAbos.betriebId, betriebId), eq(pushAbos.endpunktHash, sha256(endpoint))))
    .get();

/**
 * Registers the device of the person who writes. The same endpoint again replaces its keys and
 * language; an endpoint another person of the business registered on a shared device moves to
 * this person, as the browser has one subscription per site.
 */
export const aboSpeichern = (
  db: Db,
  schreibDb: SchreibDb,
  geheimerSchluessel: Uint8Array,
  kontext: Kontext,
  angaben: { abo: Abo; sprache: string },
): { neu: boolean } => {
  const vorhanden = nachEndpunkt(db, kontext.betriebId, angaben.abo.endpoint);
  const abo = verschluesseln(geheimerSchluessel, ZWECK, JSON.stringify(angaben.abo));
  schreiben(schreibDb, kontext, (s) => {
    if (vorhanden?.nutzerId === kontext.akteur) {
      s.aendern("pushAbos", { aboId: vorhanden.aboId }, { abo, sprache: angaben.sprache });
      return;
    }
    if (vorhanden) s.loeschen("pushAbos", { aboId: vorhanden.aboId });
    s.einfuegen("pushAbos", {
      betriebId: kontext.betriebId,
      aboId: randomUUID(),
      nutzerId: kontext.akteur,
      endpunktHash: sha256(angaben.abo.endpoint),
      abo,
      sprache: angaben.sprache,
      angelegtAm: kontext.jetzt,
    });
  });
  return { neu: vorhanden?.nutzerId !== kontext.akteur };
};

/** Unregisters a device of the person who writes; another person's stays */
export const aboEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  endpoint: string,
): boolean => {
  const vorhanden = nachEndpunkt(db, kontext.betriebId, endpoint);
  if (!vorhanden || vorhanden.nutzerId !== kontext.akteur) return false;
  schreiben(schreibDb, kontext, (s) => s.loeschen("pushAbos", { aboId: vorhanden.aboId }));
  return true;
};

/** Removes a subscription the push service no longer knows (404 or 410, RFC 8030, Section 7.3) */
export const aboVerfallen = (schreibDb: SchreibDb, kontext: Kontext, aboId: string): void => {
  schreiben(schreibDb, kontext, (s) => s.loeschen("pushAbos", { aboId }));
};

/** The devices of a person, decrypted; one that no longer decrypts is left out */
export const abosVon = (
  db: Db,
  geheimerSchluessel: Uint8Array,
  betriebId: string,
  nutzerId: string,
): GespeichertesAbo[] =>
  db
    .select()
    .from(pushAbos)
    .where(and(eq(pushAbos.betriebId, betriebId), eq(pushAbos.nutzerId, nutzerId)))
    .all()
    .flatMap((zeile) => {
      const klar = entschluesseln(geheimerSchluessel, ZWECK, zeile.abo);
      return klar.ok
        ? [{ aboId: zeile.aboId, abo: JSON.parse(klar.wert) as Abo, sprache: zeile.sprache }]
        : [];
    });
