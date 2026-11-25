import { eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { habenZugaenge } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { entschluesseln, verschluesseln } from "../geheim/index.ts";
import { apiBasis } from "./adresse.ts";
import type { HabenAnschluss } from "./haben-api.ts";

/** The purpose of the encrypted token: a value cannot be moved into another column */
const ZWECK = "haben_zugaenge:token";

/** The access as the app shows it: the address and whether a token is kept, never the token */
export type HabenZugang = { adresse: string; tokenGesetzt: true; geaendertAm: number };

const zeileLesen = (db: Db, betriebId: string) =>
  db.select().from(habenZugaenge).where(eq(habenZugaenge.betriebId, betriebId)).get();

export const zugangLesen = (db: Db, betriebId: string): HabenZugang | null => {
  const zeile = zeileLesen(db, betriebId);
  return zeile
    ? { adresse: zeile.adresse, tokenGesetzt: true, geaendertAm: zeile.geaendertAm }
    : null;
};

/**
 * Keeps the address and the token (encrypted with SOLL_SECRET_KEY); without a new token the one kept
 * stays, so the address can change without typing the token again. `token_fehlt` without either.
 */
export const zugangSetzen = (
  db: Db,
  schreibDb: SchreibDb,
  schluessel: Uint8Array,
  kontext: Kontext,
  eingabe: { adresse: string; token?: string | undefined },
): { ok: true; wert: HabenZugang } | { ok: false; grund: "token_fehlt" } => {
  const vorhanden = zeileLesen(db, kontext.betriebId);
  if (!vorhanden && eingabe.token === undefined) return { ok: false, grund: "token_fehlt" };
  const werte = {
    adresse: eingabe.adresse,
    geaendertAm: kontext.jetzt,
    ...(eingabe.token === undefined
      ? {}
      : { token: verschluesseln(schluessel, ZWECK, eingabe.token) }),
  };
  schreiben(schreibDb, kontext, (s) =>
    vorhanden
      ? s.aendern("habenZugaenge", { betriebId: kontext.betriebId }, werte)
      : s.einfuegen("habenZugaenge", {
          betriebId: kontext.betriebId,
          token: werte.token ?? "",
          adresse: werte.adresse,
          geaendertAm: werte.geaendertAm,
        }),
  );
  return {
    ok: true,
    wert: { adresse: eingabe.adresse, tokenGesetzt: true, geaendertAm: kontext.jetzt },
  };
};

/** Forgets the access; what was handed over stays (false: there was none) */
export const zugangEntfernen = (db: Db, schreibDb: SchreibDb, kontext: Kontext): boolean => {
  if (!zeileLesen(db, kontext.betriebId)) return false;
  schreiben(schreibDb, kontext, (s) =>
    s.loeschen("habenZugaenge", { betriebId: kontext.betriebId }),
  );
  return true;
};

/**
 * The connection to the business's Haben with the token decrypted, or why there is none:
 * `haben_fehlt` without an access, `schluessel_falsch` when SOLL_SECRET_KEY changed since
 */
export const anschlussVon = (
  db: Db,
  schluessel: Uint8Array,
  betriebId: string,
  holen: typeof fetch,
):
  | { ok: true; wert: HabenAnschluss }
  | { ok: false; grund: "haben_fehlt" | "schluessel_falsch" } => {
  const zeile = zeileLesen(db, betriebId);
  if (!zeile) return { ok: false, grund: "haben_fehlt" };
  const token = entschluesseln(schluessel, ZWECK, zeile.token);
  if (!token.ok) return { ok: false, grund: "schluessel_falsch" };
  return { ok: true, wert: { fetch: holen, basis: apiBasis(zeile.adresse), token: token.wert } };
};
