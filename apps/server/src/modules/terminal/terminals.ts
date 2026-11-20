import { and, eq, isNull } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { terminals } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { modulAktiv } from "../betrieb/index.ts";
import { codeNormalisieren, kopplungscode, tokenHash, zufallsToken } from "./geheimnis.ts";

export type Terminal = typeof terminals.$inferSelect;

/** How long a pairing code holds: long enough to walk to the tablet, short enough to be no key */
export const KOPPLUNG_GILT_MS = 10 * 60_000;

/** Who writes for a terminal in the audit chain: the device, not a person */
export const terminalAkteur = (terminalId: string): string => `terminal:${terminalId}`;

/**
 * A new terminal with a pairing code (S-801): the code is shown once and kept as SHA-256; it holds
 * ten minutes and is used once
 */
export const kopplungAnlegen = (
  schreibDb: SchreibDb,
  kontext: Kontext,
  name: string,
): { terminalId: string; code: string; gueltigBis: number } => {
  const code = kopplungscode();
  const terminalId = crypto.randomUUID();
  const gueltigBis = kontext.jetzt + KOPPLUNG_GILT_MS;
  schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("terminals", {
      betriebId: kontext.betriebId,
      terminalId,
      name,
      kopplungHash: tokenHash(code),
      kopplungBis: gueltigBis,
      angelegtVon: kontext.akteur,
      angelegtAm: kontext.jetzt,
    }),
  );
  return { terminalId, code, gueltigBis };
};

export type Kopplung =
  | { ok: true; token: string; terminal: Terminal }
  | { ok: false; grund: "ungueltig" | "modul_aus" };

/**
 * The tablet trades a pairing code for its device token. An unknown, used, expired or revoked code
 * is the same answer, so a guess learns nothing.
 */
export const koppeln = (db: Db, schreibDb: SchreibDb, code: string, jetzt: number): Kopplung => {
  const zeile = db
    .select()
    .from(terminals)
    .where(eq(terminals.kopplungHash, tokenHash(codeNormalisieren(code))))
    .get();
  if (!zeile || zeile.widerrufenAm !== null || (zeile.kopplungBis ?? 0) <= jetzt)
    return { ok: false, grund: "ungueltig" };
  if (!modulAktiv(db, zeile.betriebId, "terminal")) return { ok: false, grund: "modul_aus" };
  const token = zufallsToken();
  const kontext = { betriebId: zeile.betriebId, akteur: terminalAkteur(zeile.terminalId), jetzt };
  const terminal = schreiben(schreibDb, kontext, (s) =>
    s.aendern(
      "terminals",
      { terminalId: zeile.terminalId },
      { kopplungHash: null, kopplungBis: null, tokenHash: tokenHash(token), gekoppeltAm: jetzt },
    ),
  );
  return { ok: true, token, terminal };
};

/** The paired terminal of a device token, unless it was revoked */
export const terminalVonToken = (db: Db, token: string): Terminal | undefined =>
  db
    .select()
    .from(terminals)
    .where(and(eq(terminals.tokenHash, tokenHash(token)), isNull(terminals.widerrufenAm)))
    .get();

export const terminalLesen = (db: Db, betriebId: string, terminalId: string) =>
  db
    .select()
    .from(terminals)
    .where(and(eq(terminals.betriebId, betriebId), eq(terminals.terminalId, terminalId)))
    .get();

/** The terminals of a business that are not revoked, for the owner; no hash leaves the server */
export const terminalsVon = (db: Db, betriebId: string, jetzt: number) =>
  db
    .select()
    .from(terminals)
    .where(and(eq(terminals.betriebId, betriebId), isNull(terminals.widerrufenAm)))
    .orderBy(terminals.angelegtAm)
    .all()
    .filter((t) => t.gekoppeltAm !== null || (t.kopplungBis ?? 0) > jetzt)
    .map((t) => ({
      terminalId: t.terminalId,
      name: t.name,
      gekoppeltAm: t.gekoppeltAm,
      kopplungBis: t.gekoppeltAm === null ? t.kopplungBis : null,
      gesperrtBis: t.gesperrtBis !== null && t.gesperrtBis > jetzt ? t.gesperrtBis : null,
    }));

/**
 * Revokes a terminal: its token and an open pairing code stop at once; the row stays for the audit
 * chain and the stamps that name it
 */
export const terminalWiderrufen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  terminalId: string,
): boolean => {
  const zeile = terminalLesen(db, kontext.betriebId, terminalId);
  if (!zeile || zeile.widerrufenAm !== null) return false;
  schreiben(schreibDb, kontext, (s) =>
    s.aendern(
      "terminals",
      { terminalId },
      { widerrufenAm: kontext.jetzt, kopplungHash: null, kopplungBis: null },
    ),
  );
  return true;
};
