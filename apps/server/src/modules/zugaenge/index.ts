import { randomBytes } from "node:crypto";
import { tagInBerlin } from "@soll/arbeitszeit";
import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { apiZugaenge } from "../../db/schema.ts";
import { sha256 } from "../audit/hash.ts";
import { type Kontext, schreiben } from "../audit/index.ts";

export { AUFRUFE_JE_MINUTE, type GrenzErgebnis, type RatenGrenze, ratenGrenze } from "./grenze.ts";

/*
 * Personal access tokens for the REST API and the MCP server (S-607). A token belongs to one person
 * in one business and carries no rights of its own: whoever calls with it has the rights of that
 * person's role at the time of the call (routes/kontext.ts).
 */

/** Every token starts with this, so a secret scanner and a person recognise it */
export const TOKEN_ANFANG = "soll_";
/** The characters of a token shown in the list: the start and four random ones */
const PRAEFIX_LAENGE = TOKEN_ANFANG.length + 4;
/** The expiries a person can choose, in days; null for none */
export const GUELTIGKEITEN = [30, 90, 365] as const;
export type Gueltigkeit = (typeof GUELTIGKEITEN)[number] | null;

const TAG_MS = 24 * 60 * 60 * 1000;

export type Zugang = typeof apiZugaenge.$inferSelect;
/** What the list shows of a token: never its hash */
export type ZugangAnsicht = Omit<Zugang, "betriebId" | "nutzerId" | "tokenHash">;

const ansicht = ({ betriebId: _b, nutzerId: _n, tokenHash: _h, ...rest }: Zugang): ZugangAnsicht =>
  rest;

/** The tokens of one person in one business, newest first */
export const zugaengeVon = (db: Db, betriebId: string, nutzerId: string): ZugangAnsicht[] =>
  db
    .select()
    .from(apiZugaenge)
    .where(and(eq(apiZugaenge.betriebId, betriebId), eq(apiZugaenge.nutzerId, nutzerId)))
    .all()
    .sort((a, b) => b.angelegtAm - a.angelegtAm)
    .map(ansicht);

/** A new token for the actor of `kontext`: 32 random bytes; the token leaves only in the answer */
export const zugangAnlegen = (
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: { name: string; gueltigTage: Gueltigkeit },
): { zugang: ZugangAnsicht; token: string } => {
  const token = `${TOKEN_ANFANG}${randomBytes(32).toString("base64url")}`;
  const zeile = schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("apiZugaenge", {
      betriebId: kontext.betriebId,
      zugangId: crypto.randomUUID(),
      nutzerId: kontext.akteur,
      name: angaben.name,
      praefix: token.slice(0, PRAEFIX_LAENGE),
      tokenHash: sha256(token),
      angelegtAm: kontext.jetzt,
      gueltigBis:
        angaben.gueltigTage === null ? null : kontext.jetzt + angaben.gueltigTage * TAG_MS,
      zuletztGenutzt: null,
    }),
  );
  return { zugang: ansicht(zeile), token };
};

/** Removes a token of the actor in the business; false when there is no such token of theirs */
export const zugangWiderrufen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  zugangId: string,
): boolean => {
  const zeile = db
    .select()
    .from(apiZugaenge)
    .where(and(eq(apiZugaenge.betriebId, kontext.betriebId), eq(apiZugaenge.zugangId, zugangId)))
    .get();
  if (!zeile || zeile.nutzerId !== kontext.akteur) return false;
  schreiben(schreibDb, kontext, (s) => s.loeschen("apiZugaenge", { zugangId }));
  return true;
};

export type Gefunden =
  | { ok: true; zugang: Zugang }
  | { ok: false; grund: "ungueltig" | "abgelaufen" };

/** The token's row by the hash of the token, if it exists and has not expired */
export const zugangFinden = (db: Db, token: string, jetzt: number): Gefunden => {
  if (!token.startsWith(TOKEN_ANFANG)) return { ok: false, grund: "ungueltig" };
  const zugang = db
    .select()
    .from(apiZugaenge)
    .where(eq(apiZugaenge.tokenHash, sha256(token)))
    .get();
  if (!zugang) return { ok: false, grund: "ungueltig" };
  if (zugang.gueltigBis !== null && jetzt >= zugang.gueltigBis)
    return { ok: false, grund: "abgelaufen" };
  return { ok: true, zugang };
};

/**
 * The day of the last use, through the audit chain like every write; only when the day changed, so
 * a token in daily use adds one link a day, not one per call
 */
export const nutzungMerken = (schreibDb: SchreibDb, zugang: Zugang, jetzt: number): void => {
  const heute = tagInBerlin(jetzt);
  if (zugang.zuletztGenutzt === heute) return;
  const kontext = { betriebId: zugang.betriebId, akteur: zugang.nutzerId, jetzt };
  schreiben(schreibDb, kontext, (s) =>
    s.aendern("apiZugaenge", { zugangId: zugang.zugangId }, { zuletztGenutzt: heute }),
  );
};
