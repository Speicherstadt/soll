import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { instanzschluessel } from "../../db/schema.ts";
import { schreiben } from "../audit/index.ts";
import { entschluesseln, verschluesseln } from "../geheim/index.ts";
import { schluesselPaar, type VapidPaar } from "./webpush.ts";

/** The reserved `betrieb_id` of the instance's own rows; Better Auth's ids never take this form */
export const INSTANZ = "instanz";
const NAME = "vapid";
const ZWECK = `instanzschluessel:${NAME}`;

const lesen = (db: Db) =>
  db
    .select()
    .from(instanzschluessel)
    .where(and(eq(instanzschluessel.betriebId, INSTANZ), eq(instanzschluessel.name, NAME)))
    .get();

/**
 * The instance's VAPID key pair (RFC 8292): created on the first start, the private key encrypted
 * with SOLL_SECRET_KEY (CLAUDE.md, "Secrets"). With another key the server refuses to start, as a
 * new pair would silently cut off every device that subscribed.
 */
export const vapidLaden = (
  db: Db,
  schreibDb: SchreibDb,
  geheimerSchluessel: Uint8Array,
  jetzt: number,
): VapidPaar => {
  const vorhanden = lesen(db);
  if (vorhanden) {
    const privat = entschluesseln(geheimerSchluessel, ZWECK, vorhanden.privat);
    if (!privat.ok) throw new Error("VAPID key cannot be decrypted: SOLL_SECRET_KEY changed");
    return { oeffentlich: vorhanden.oeffentlich, privat: privat.wert };
  }
  const paar = schluesselPaar();
  schreiben(schreibDb, { betriebId: INSTANZ, akteur: "system", jetzt }, (s) =>
    s.einfuegen("instanzschluessel", {
      betriebId: INSTANZ,
      name: NAME,
      oeffentlich: paar.oeffentlich,
      privat: verschluesseln(geheimerSchluessel, ZWECK, paar.privat),
      angelegtAm: jetzt,
    }),
  );
  return paar;
};
