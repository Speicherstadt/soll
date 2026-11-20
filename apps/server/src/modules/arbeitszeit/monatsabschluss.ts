import { type Monat, monatVon, type Tag, tagInBerlin } from "@soll/arbeitszeit";
import { and, asc, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { auditGlieder, monatsabschluesse } from "../../db/schema.ts";
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

/** Where a person's month stands: confirmed (still valid for the records now?), closed */
export type MonatStatus = {
  monat: Monat;
  /** the month as closed, or as it stands now while open */
  inhalt: Monatsinhalt;
  offeneTage: Tag[];
  bestaetigung: Bestaetigung | null;
  abschluss: Abschluss | null;
  /** whether the month has ended; a running month is neither confirmed nor closed */
  vorbei: boolean;
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
    vorbei: monat < monatVon(tagInBerlin(jetzt)),
  };
};

export type AbschlussFehler =
  | "monat_laeuft"
  | "abgeschlossen"
  | "offene_schicht"
  | "bestaetigung_fehlt";

export type SchrittErgebnis =
  | { ok: true; status: MonatStatus }
  | { ok: false; grund: AbschlussFehler };

const schrittEinfuegen = (
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: {
    nutzerId: string;
    schritt: Zeile["schritt"];
    inhalt: Monatsinhalt;
    grund: string | null;
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
      erstelltVon: kontext.akteur,
      erstelltAm: kontext.jetzt,
    }),
  );

/** Why a month cannot take a step now, or null */
const hindernis = (status: MonatStatus): AbschlussFehler | null => {
  if (!status.vorbei) return "monat_laeuft";
  if (status.abschluss) return "abgeschlossen";
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
    if (/UNIQUE constraint failed: monatsabschluesse/.test(String(fehler)))
      return { ok: false, grund: "abgeschlossen" };
    throw fehler;
  }
  return {
    ok: true,
    status: monatStatus(db, kontext.betriebId, angaben.nutzerId, angaben.monat, kontext.jetzt),
  };
};
