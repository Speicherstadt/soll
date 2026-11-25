import { type Monat, monatVon, NEUE_SCHICHT_AB, type Tag, tagInBerlin } from "@soll/arbeitszeit";
import { and, asc, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { auditGlieder, aussonderungen, monatsabschluesse } from "../../db/schema.ts";
import { kanonisch } from "../audit/hash.ts";
import { formatPruefwert, type Kontext, schreiben } from "../audit/index.ts";
import { monatJetzt } from "./monat.ts";
import { abweichendeTage, inhaltHash, type Monatsinhalt } from "./monatsinhalt.ts";

/*
 * Closing a month (S-306): the person confirms, then the business closes. The closing row carries
 * the month's content and its hash; its link in the audit chain is the person's Prüfwert.
 */

type Zeile = typeof monatsabschluesse.$inferSelect;

/** The steps of a person's month, in the order they were taken */
const schritteVon = (db: Db, betriebId: string, nutzerId: string, monat: Monat): Zeile[] =>
  db
    .select()
    .from(monatsabschluesse)
    .where(
      and(
        eq(monatsabschluesse.betriebId, betriebId),
        eq(monatsabschluesse.nutzerId, nutzerId),
        eq(monatsabschluesse.monat, monat),
      ),
    )
    .orderBy(asc(monatsabschluesse.erstelltAm))
    .all();

const inhaltVon = (zeile: Zeile): Monatsinhalt => JSON.parse(zeile.inhalt) as Monatsinhalt;

/** The link that wrote a closing row: its number and hash are the Prüfwert */
const gliedVon = (db: Db, betriebId: string, abschlussId: string) =>
  db
    .select()
    .from(auditGlieder)
    .where(
      and(
        eq(auditGlieder.betriebId, betriebId),
        eq(auditGlieder.tabelle, "monatsabschluesse"),
        eq(auditGlieder.zeile, JSON.stringify([abschlussId])),
        eq(auditGlieder.aktion, "einfuegen"),
      ),
    )
    .get();

export type Bestaetigung = { von: string; am: number; gueltig: boolean };
export type Abschluss = {
  abschlussId: string;
  von: string;
  am: number;
  grund: string | null;
  pruefwert: string | null;
  inhalt: Monatsinhalt;
};

export type Ausgesondert = { am: number; abgeschlossenAm: number; jahre: number };

const aussonderungVon = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  monat: Monat,
): Ausgesondert | null => {
  const zeile = db
    .select()
    .from(aussonderungen)
    .where(
      and(
        eq(aussonderungen.betriebId, betriebId),
        eq(aussonderungen.nutzerId, nutzerId),
        eq(aussonderungen.monat, monat),
      ),
    )
    .get();
  return zeile
    ? { am: zeile.ausgesondertAm, abgeschlossenAm: zeile.abgeschlossenAm, jahre: zeile.jahre }
    : null;
};

/** Where a person's month stands: confirmed (still valid for the records now?), closed */
export type MonatStatus = {
  monat: Monat;
  /** the month as closed, or as it stands now while open */
  inhalt: Monatsinhalt;
  offeneTage: Tag[];
  bestaetigung: Bestaetigung | null;
  abschluss: Abschluss | null;
  /**
   * the month was closed and its content removed after the retention period (S-901): it stays
   * locked, and neither its records nor its closing can be shown any more
   */
  ausgesondert: Ausgesondert | null;
  /** whether the month has ended; a running month is neither confirmed nor closed */
  vorbei: boolean;
  /**
   * while open: the instant before which the month cannot be closed yet, as its last shift could
   * still go on (9 h after its last stamp); null when that has passed
   */
  abschliessbarAb: number | null;
};

/**
 * 9 h after the last stamp a month records (`NEUE_SCHICHT_AB`, as the shifts are cut): before then a
 * Kommen would continue its last shift, and the lock would refuse to record it (BAG 1 ABR 22/21;
 * docs/plan.md, "Abschluss nach der letzten Schicht")
 */
const schichtEndetSicher = (inhalt: Monatsinhalt): number | null => {
  const zeitpunkte = inhalt.tage.flatMap((tag) => tag.stempel.map(([, zeitpunkt]) => zeitpunkt));
  return zeitpunkte.length === 0 ? null : Math.max(...zeitpunkte) + NEUE_SCHICHT_AB;
};

export const monatStatus = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  monat: Monat,
  jetzt: number,
): MonatStatus => {
  const schritte = schritteVon(db, betriebId, nutzerId, monat);
  const geschlossen = schritte.find((zeile) => zeile.schritt === "abgeschlossen");
  const bestaetigt = schritte.filter((zeile) => zeile.schritt === "bestaetigt").at(-1);
  const jetztStand = monatJetzt(db, betriebId, nutzerId, monat, jetzt);
  const glied = geschlossen ? gliedVon(db, betriebId, geschlossen.abschlussId) : undefined;
  const ab = geschlossen ? null : schichtEndetSicher(jetztStand.inhalt);
  return {
    monat,
    inhalt: geschlossen ? inhaltVon(geschlossen) : jetztStand.inhalt,
    offeneTage: geschlossen ? [] : jetztStand.offeneTage,
    bestaetigung: bestaetigt
      ? {
          von: bestaetigt.erstelltVon,
          am: bestaetigt.erstelltAm,
          // a confirmation holds for the records the person saw, not for a later change
          gueltig:
            abweichendeTage(
              inhaltVon(bestaetigt).tage,
              (geschlossen ? inhaltVon(geschlossen) : jetztStand.inhalt).tage,
            ).length === 0,
        }
      : null,
    abschluss: geschlossen
      ? {
          abschlussId: geschlossen.abschlussId,
          von: geschlossen.erstelltVon,
          am: geschlossen.erstelltAm,
          grund: geschlossen.grund,
          pruefwert: glied ? formatPruefwert(glied) : null,
          inhalt: inhaltVon(geschlossen),
        }
      : null,
    ausgesondert: aussonderungVon(db, betriebId, nutzerId, monat),
    vorbei: monat < monatVon(tagInBerlin(jetzt)),
    abschliessbarAb: ab !== null && jetzt < ab ? ab : null,
  };
};

export type AbschlussFehler =
  | "monat_laeuft"
  | "abgeschlossen"
  | "offene_schicht"
  | "bestaetigung_fehlt"
  | "schicht_kann_weiterlaufen";

export type SchrittErgebnis =
  | { ok: true; status: MonatStatus }
  | { ok: false; grund: AbschlussFehler; ab?: number };

const schrittEinfuegen = (
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: {
    nutzerId: string;
    schritt: Zeile["schritt"];
    inhalt: Monatsinhalt;
    grund: string | null;
    importId?: string;
  },
) =>
  schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("monatsabschluesse", {
      betriebId: kontext.betriebId,
      abschlussId: crypto.randomUUID(),
      nutzerId: angaben.nutzerId,
      monat: angaben.inhalt.monat,
      schritt: angaben.schritt,
      inhalt: kanonisch(angaben.inhalt),
      inhaltHash: inhaltHash(angaben.inhalt),
      grund: angaben.grund,
      sperrt: angaben.schritt === "abgeschlossen" ? angaben.inhalt.monat : null,
      importId: angaben.importId ?? null,
      erstelltVon: kontext.akteur,
      erstelltAm: kontext.jetzt,
    }),
  );

/** Two closings at once: the unique index lets only the first through, the second is refused */
const einmal = (fehler: unknown): SchrittErgebnis => {
  if (/UNIQUE constraint failed: monatsabschluesse/.test(String(fehler)))
    return { ok: false, grund: "abgeschlossen" };
  throw fehler;
};

/** Why a month cannot take a step now, or null */
const hindernis = (status: MonatStatus): AbschlussFehler | null => {
  if (!status.vorbei) return "monat_laeuft";
  if (status.abschluss || status.ausgesondert) return "abgeschlossen";
  if (status.offeneTage.length > 0) return "offene_schicht";
  return null;
};

/** The person confirms their own month as it stands now; again after a change */
export const monatBestaetigen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  monat: Monat,
): SchrittErgebnis => {
  const status = monatStatus(db, kontext.betriebId, kontext.akteur, monat, kontext.jetzt);
  const fehler = hindernis(status);
  if (fehler) return { ok: false, grund: fehler };
  schrittEinfuegen(schreibDb, kontext, {
    nutzerId: kontext.akteur,
    schritt: "bestaetigt",
    inhalt: status.inhalt,
    grund: null,
  });
  return {
    ok: true,
    status: monatStatus(db, kontext.betriebId, kontext.akteur, monat, kontext.jetzt),
  };
};

/**
 * The business closes a person's month, which locks it: after a valid confirmation of the person,
 * else only with a reason (docs/plan.md, "Reihenfolge des Abschlusses"). Two at once: the unique
 * index lets only the first through.
 */
export const monatAbschliessen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: { nutzerId: string; monat: Monat; grund: string | null },
): SchrittErgebnis => {
  const status = monatStatus(db, kontext.betriebId, angaben.nutzerId, angaben.monat, kontext.jetzt);
  const fehler = hindernis(status);
  if (fehler) return { ok: false, grund: fehler };
  if (status.abschliessbarAb !== null)
    return { ok: false, grund: "schicht_kann_weiterlaufen", ab: status.abschliessbarAb };
  if (!status.bestaetigung?.gueltig && angaben.grund === null)
    return { ok: false, grund: "bestaetigung_fehlt" };
  try {
    schrittEinfuegen(schreibDb, kontext, {
      nutzerId: angaben.nutzerId,
      schritt: "abgeschlossen",
      inhalt: status.inhalt,
      grund: status.bestaetigung?.gueltig ? null : angaben.grund,
    });
  } catch (fehler) {
    return einmal(fehler);
  }
  return {
    ok: true,
    status: monatStatus(db, kontext.betriebId, angaben.nutzerId, angaben.monat, kontext.jetzt),
  };
};

/**
 * Closes a month the old tool had closed, after an import took it over (S-701): no confirmation of
 * the person, whose records the old tool kept; `grund` says where it came from and stands on the
 * time sheet. Otherwise as any closing: only a past month without an open shift, only once, and its
 * link is the Prüfwert.
 */
export const monatUebernehmen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: { nutzerId: string; monat: Monat; grund: string; importId: string },
): SchrittErgebnis => {
  const status = monatStatus(db, kontext.betriebId, angaben.nutzerId, angaben.monat, kontext.jetzt);
  const fehler = hindernis(status);
  if (fehler) return { ok: false, grund: fehler };
  if (status.abschliessbarAb !== null)
    return { ok: false, grund: "schicht_kann_weiterlaufen", ab: status.abschliessbarAb };
  try {
    schrittEinfuegen(schreibDb, kontext, {
      nutzerId: angaben.nutzerId,
      schritt: "abgeschlossen",
      inhalt: status.inhalt,
      grund: angaben.grund,
      importId: angaben.importId,
    });
  } catch (fehler) {
    return einmal(fehler);
  }
  return {
    ok: true,
    status: monatStatus(db, kontext.betriebId, angaben.nutzerId, angaben.monat, kontext.jetzt),
  };
};
