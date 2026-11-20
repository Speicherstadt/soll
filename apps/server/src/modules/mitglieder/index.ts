import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { Rolle } from "../../auth/rollen.ts";
import { user } from "../../db/auth-schema.ts";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { einladungen, mitgliedschaften } from "../../db/schema.ts";
import { sha256 } from "../audit/hash.ts";
import { type Kontext, schreiben } from "../audit/index.ts";

export type Mitgliedschaft = typeof mitgliedschaften.$inferSelect;

export const mitgliedschaftVon = (
  db: Db,
  betriebId: string,
  nutzerId: string,
): Mitgliedschaft | undefined =>
  db
    .select()
    .from(mitgliedschaften)
    .where(and(eq(mitgliedschaften.betriebId, betriebId), eq(mitgliedschaften.nutzerId, nutzerId)))
    .get();

export type MitgliedMitName = { nutzerId: string; name: string; rolle: string };

/** The members of a business with the names of their accounts, by name */
export const mitgliederMitNamen = (db: Db, betriebId: string): MitgliedMitName[] =>
  db
    .select({ nutzerId: mitgliedschaften.nutzerId, name: user.name, rolle: mitgliedschaften.rolle })
    .from(mitgliedschaften)
    .innerJoin(user, eq(user.id, mitgliedschaften.nutzerId))
    .where(eq(mitgliedschaften.betriebId, betriebId))
    .orderBy(user.name)
    .all();

/**
 * The names of accounts, for who changed what: also of someone who has left the business since,
 * whose changes stay visible
 */
export const namenVon = (db: Db, nutzerIds: readonly string[]): Map<string, string> =>
  nutzerIds.length === 0
    ? new Map()
    : new Map(
        db
          .select({ id: user.id, name: user.name })
          .from(user)
          .where(inArray(user.id, [...new Set(nutzerIds)]))
          .all()
          .map(({ id, name }) => [id, name]),
      );

/**
 * Mirrors a member and role of Better Auth into Soll's table, so each change stands in the audit
 * chain; called by the hooks of src/auth/auth.ts
 */
export const mitgliedschaftSpiegeln = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
  rolle: string,
): void => {
  const bisher = mitgliedschaftVon(db, kontext.betriebId, nutzerId);
  if (bisher?.rolle === rolle) return;
  schreiben(schreibDb, kontext, (s) =>
    bisher
      ? s.aendern("mitgliedschaften", { nutzerId }, { rolle })
      : s.einfuegen("mitgliedschaften", {
          betriebId: kontext.betriebId,
          nutzerId,
          rolle,
          seit: kontext.jetzt,
        }),
  );
};

export const mitgliedschaftEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
): void => {
  if (!mitgliedschaftVon(db, kontext.betriebId, nutzerId)) return;
  schreiben(schreibDb, kontext, (s) => s.loeschen("mitgliedschaften", { nutzerId }));
};

/** An invitation is valid for a week unless the business chooses otherwise */
export const EINLADUNG_GUELTIG_MS = 7 * 24 * 60 * 60 * 1000;

export type Einladung = typeof einladungen.$inferSelect;

type NeueEinladung = { rolle: Rolle; name: string };

/**
 * Invitations by link or QR code for people without e-mail, all in one transaction (one or a list
 * from the setup, S-303): each token goes into its link and only its hash into the database
 */
export const einladungenErstellen = (
  schreibDb: SchreibDb,
  kontext: Kontext,
  personen: readonly NeueEinladung[],
): { einladung: Einladung; token: string }[] =>
  schreiben(schreibDb, kontext, (s) =>
    personen.map((angaben) => {
      const token = randomBytes(32).toString("base64url");
      const einladung = s.einfuegen("einladungen", {
        betriebId: kontext.betriebId,
        einladungId: crypto.randomUUID(),
        tokenHash: sha256(token),
        rolle: angaben.rolle,
        name: angaben.name,
        erstelltVon: kontext.akteur,
        gueltigBis: kontext.jetzt + EINLADUNG_GUELTIG_MS,
      });
      return { einladung, token };
    }),
  );

export const einladungErstellen = (
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: NeueEinladung,
): { einladung: Einladung; token: string } =>
  einladungenErstellen(schreibDb, kontext, [angaben])[0] as { einladung: Einladung; token: string };

export type EinladungErgebnis =
  | { ok: true; einladung: Einladung }
  | { ok: false; grund: "unbekannt" | "abgelaufen" | "angenommen" };

/** The invitation a token names, if it is still open */
export const einladungFinden = (db: Db, token: string, jetzt: number): EinladungErgebnis => {
  const einladung = db
    .select()
    .from(einladungen)
    .where(eq(einladungen.tokenHash, sha256(token)))
    .get();
  if (!einladung) return { ok: false, grund: "unbekannt" };
  if (einladung.angenommenVon) return { ok: false, grund: "angenommen" };
  if (einladung.gueltigBis <= jetzt) return { ok: false, grund: "abgelaufen" };
  return { ok: true, einladung };
};

export const einladungAngenommen = (
  schreibDb: SchreibDb,
  kontext: Kontext,
  einladungId: string,
  nutzerId: string,
) =>
  schreiben(schreibDb, kontext, (s) =>
    s.aendern("einladungen", { einladungId }, { angenommenVon: nutzerId }),
  );
