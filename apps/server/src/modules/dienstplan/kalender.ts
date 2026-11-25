import { randomBytes } from "node:crypto";
import { plusTage, type Tag, tagInBerlin } from "@soll/arbeitszeit";
import { icsKalender } from "@soll/export";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { darf } from "../../auth/rollen.ts";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { kalenderAbos, schichten } from "../../db/schema.ts";
import { type Kontext, schreiben, sha256, verlaufVon } from "../audit/index.ts";
import { betriebLesen, modulAktiv } from "../betrieb/index.ts";
import { type Sprache, spracheVon } from "../erinnerungen/index.ts";
import { mitgliedschaftVon } from "../mitglieder/index.ts";
import { standorteLesen } from "../standorte/index.ts";
import { terminBeschreibung, terminTitel } from "./texte.ts";

/*
 * The calendar feed of a person (S-503): their published shifts as iCalendar under a link with a
 * secret token, for a calendar app to subscribe to. The token is kept only as its SHA-256, like the
 * API tokens (S-607): whoever reads the database cannot rebuild the link. One feed per person and
 * business; issuing it again replaces the token, revoking removes it.
 */

/** Every token starts with this, so a person and a secret scanner recognise it */
export const KALENDER_ANFANG = "soll_ics_";
/** How far back the feed reaches: six weeks of shifts already worked stay in the calendar */
const RUECKBLICK_TAGE = 42;

export type KalenderAbo = typeof kalenderAbos.$inferSelect;
/** What the app shows of a feed: never its hash */
export type KalenderAnsicht = { angelegtAm: number; sprache: string };

const dieser = (betriebId: string, nutzerId: string) =>
  and(eq(kalenderAbos.betriebId, betriebId), eq(kalenderAbos.nutzerId, nutzerId));

/** The feed of a person in a business, if they have one */
export const kalenderVon = (
  db: Db,
  betriebId: string,
  nutzerId: string,
): KalenderAnsicht | null => {
  const zeile = db.select().from(kalenderAbos).where(dieser(betriebId, nutzerId)).get();
  return zeile ? { angelegtAm: zeile.angelegtAm, sprache: zeile.sprache } : null;
};

/**
 * Issues the feed of the actor, or issues it again: 32 random bytes, the token leaves only in the
 * answer; an earlier token stops working at once
 */
export const kalenderAusstellen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  sprache: Sprache,
): { token: string; abo: KalenderAnsicht } => {
  const token = `${KALENDER_ANFANG}${randomBytes(32).toString("base64url")}`;
  const werte = { tokenHash: sha256(token), sprache, angelegtAm: kontext.jetzt };
  const schluessel = { betriebId: kontext.betriebId, nutzerId: kontext.akteur };
  const vorhanden = kalenderVon(db, kontext.betriebId, kontext.akteur) !== null;
  schreiben(schreibDb, kontext, (s) =>
    vorhanden
      ? s.aendern("kalenderAbos", schluessel, werte)
      : s.einfuegen("kalenderAbos", { ...schluessel, ...werte }),
  );
  return { token, abo: { angelegtAm: kontext.jetzt, sprache } };
};

/** Revokes the actor's feed; false when there is none */
export const kalenderWiderrufen = (db: Db, schreibDb: SchreibDb, kontext: Kontext): boolean => {
  if (kalenderVon(db, kontext.betriebId, kontext.akteur) === null) return false;
  schreiben(schreibDb, kontext, (s) =>
    s.loeschen("kalenderAbos", { betriebId: kontext.betriebId, nutzerId: kontext.akteur }),
  );
  return true;
};

export type FeedErgebnis =
  | { ok: true; ics: string }
  | { ok: false; grund: "unbekannt" | "modul_aus" };

/** The published shifts of a person from a day on, every site of the business */
const veroeffentlichteVon = (db: Db, betriebId: string, nutzerId: string, von: Tag) =>
  db
    .select()
    .from(schichten)
    .where(
      and(
        eq(schichten.betriebId, betriebId),
        eq(schichten.nutzerId, nutzerId),
        isNotNull(schichten.veroeffentlichtAm),
        gte(schichten.tag, von),
      ),
    )
    .all();

/** The feed of an abo as iCalendar: CREATED, LAST-MODIFIED and SEQUENCE from the audit chain */
const feedVon = (db: Db, abo: KalenderAbo, jetzt: number): string => {
  const sprache = spracheVon(abo.sprache);
  const geplant = veroeffentlichteVon(
    db,
    abo.betriebId,
    abo.nutzerId,
    plusTage(tagInBerlin(jetzt), -RUECKBLICK_TAGE),
  );
  const orte = new Map(standorteLesen(db, abo.betriebId).map((s) => [s.standortId, s.name]));
  const verlauf = verlaufVon(
    db,
    abo.betriebId,
    "schichten",
    geplant.map(({ schichtId }) => ({ schichtId })),
  );
  return icsKalender({
    produkt: "-//Soll//Dienstplan//DE",
    name: `Soll · ${betriebLesen(db, abo.betriebId)?.name ?? ""}`,
    termine: geplant.map((schicht) => {
      const v = verlauf.get(JSON.stringify([schicht.schichtId]));
      return {
        uid: schicht.schichtId,
        beginn: schicht.beginn,
        ende: schicht.ende,
        erstellt: v?.erstes ?? schicht.angelegtAm,
        geaendert: v?.letztes ?? schicht.veroeffentlichtAm ?? schicht.angelegtAm,
        sequenz: v?.aenderungen ?? 0,
        titel: terminTitel(sprache, schicht.rolle),
        ort: orte.get(schicht.standortId) ?? "",
        beschreibung: terminBeschreibung(sprache, schicht.pauseMinuten),
      };
    }),
  });
};

/**
 * The feed behind a token: refused for a token nobody holds, a person who is no longer a member who
 * reads the plan, and while the business has the module Dienstplan off
 */
export const kalenderFeed = (db: Db, token: string, jetzt: number): FeedErgebnis => {
  if (!token.startsWith(KALENDER_ANFANG)) return { ok: false, grund: "unbekannt" };
  const abo = db
    .select()
    .from(kalenderAbos)
    .where(eq(kalenderAbos.tokenHash, sha256(token)))
    .get();
  if (!abo) return { ok: false, grund: "unbekannt" };
  const mitglied = mitgliedschaftVon(db, abo.betriebId, abo.nutzerId);
  if (!mitglied || !darf(mitglied.rolle, "plan:lesen")) return { ok: false, grund: "unbekannt" };
  if (!modulAktiv(db, abo.betriebId, "dienstplan")) return { ok: false, grund: "modul_aus" };
  return { ok: true, ics: feedVon(db, abo, jetzt) };
};
