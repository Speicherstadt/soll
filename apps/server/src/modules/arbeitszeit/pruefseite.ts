import { type Monat, type Tag, tagInBerlin } from "@soll/arbeitszeit";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { auditGlieder, aussonderungen, monatsabschluesse } from "../../db/schema.ts";
import { kanonisch, sha256 } from "../audit/hash.ts";
import { formatPruefwert, parsePruefwert, pruefwertPruefen } from "../audit/index.ts";
import { aufbewahrungsjahre, aussonderbarAb } from "./aufbewahrung.ts";
import { aufzeichnungenJetzt, gegeneintraegeVon } from "./monat.ts";
import { abweichendeTage, type Gegeneintrag, type Monatsinhalt } from "./monatsinhalt.ts";
import { lohnmodelle } from "./zuordnungen.ts";

/**
 * What the check page answers for a Prüfwert (S-306). `abweichung` names what no longer matches:
 * the chain up to the link (`kette`), the closing row itself (`abschluss`) or the records of days.
 */
export type Pruefung =
  | { ergebnis: "unlesbar" | "unbekannt" }
  | { ergebnis: "abweichung"; grund: "kette" | "abschluss" }
  | {
      /** the Prüfwert is genuine; the month's content was removed after its retention period */
      ergebnis: "ausgesondert";
      monat: Monat;
      abgeschlossenAm: number;
      ausgesondertAm: number;
      jahre: number;
    }
  | {
      ergebnis: "uebereinstimmend" | "abweichung";
      grund: "tage" | null;
      nutzerId: string;
      monat: Monat;
      abgeschlossenAm: number;
      /** days whose stamps or Soll differ from the month as closed */
      tage: Tag[];
      /** counter-entries made to the month after it closed: corrections, no change */
      gegeneintraege: (Gegeneintrag & { am: number })[];
    };

const zeileVon = (db: Db, betriebId: string, abschlussId: string) =>
  db
    .select()
    .from(monatsabschluesse)
    .where(
      and(
        eq(monatsabschluesse.betriebId, betriebId),
        eq(monatsabschluesse.abschlussId, abschlussId),
      ),
    )
    .get();

type Glied = typeof auditGlieder.$inferSelect;

/**
 * The removal of a closing (S-901), if it went through the chain: its row matches its link, the
 * chain up to that link is intact, it names the closing's link and came no sooner than the
 * retention period the person's models give. Else a removal written past the chain could hide a
 * changed month.
 */
const aussonderungVon = (db: Db, betriebId: string, abschlussId: string, abschluss: Glied) => {
  const zeile = db
    .select()
    .from(aussonderungen)
    .where(
      and(eq(aussonderungen.betriebId, betriebId), eq(aussonderungen.abschlussId, abschlussId)),
    )
    .get();
  if (!zeile) return null;
  const glied = db
    .select()
    .from(auditGlieder)
    .where(
      and(
        eq(auditGlieder.betriebId, betriebId),
        eq(auditGlieder.tabelle, "aussonderungen"),
        eq(auditGlieder.zeile, JSON.stringify([zeile.aussonderungId])),
      ),
    )
    .orderBy(desc(auditGlieder.seq))
    .get();
  const jahre = aufbewahrungsjahre(lohnmodelle(db, betriebId, zeile.nutzerId), zeile.monat);
  const echt =
    glied?.aktion === "einfuegen" &&
    sha256(kanonisch(zeile)) === glied.inhaltHash &&
    pruefwertPruefen(db, betriebId, formatPruefwert(glied)) === "gueltig" &&
    zeile.abgeschlossenAm === abschluss.zeitpunkt &&
    zeile.jahre === jahre &&
    aussonderbarAb(abschluss.zeitpunkt, jahre) <= tagInBerlin(glied.zeitpunkt);
  return echt ? zeile : null;
};

/**
 * Checks a Prüfwert of a time sheet against the database of a business: the chain up to its link
 * must be intact (`pruefwertPruefen`, S-102), the link must have written a closing row that is still
 * as it was, and the records of the month now must be those the row closed. A change past the chain
 * shows here, and so does a chain computed anew: the link with the number then carries another hash.
 */
export const pruefwertEinesMonats = (db: Db, betriebId: string, text: string): Pruefung => {
  const kette = pruefwertPruefen(db, betriebId, text);
  if (kette === "unlesbar" || kette === "unbekannt") return { ergebnis: kette };
  if (kette === "abweichend") return { ergebnis: "abweichung", grund: "kette" };
  const wert = parsePruefwert(text);
  const glied = wert
    ? db
        .select()
        .from(auditGlieder)
        .where(and(eq(auditGlieder.betriebId, betriebId), eq(auditGlieder.seq, wert.seq)))
        .get()
    : undefined;
  // a Prüfwert of the chain that is no time sheet's: nothing to compare a month with
  if (glied?.tabelle !== "monatsabschluesse" || glied.aktion !== "einfuegen")
    return { ergebnis: "unbekannt" };
  const [abschlussId] = JSON.parse(glied.zeile) as [string];
  const zeile = zeileVon(db, betriebId, abschlussId);
  const entfernt = zeile ? null : aussonderungVon(db, betriebId, abschlussId, glied);
  if (entfernt)
    return {
      ergebnis: "ausgesondert",
      monat: entfernt.monat,
      abgeschlossenAm: entfernt.abgeschlossenAm,
      ausgesondertAm: entfernt.ausgesondertAm,
      jahre: entfernt.jahre,
    };
  if (
    zeile?.schritt !== "abgeschlossen" ||
    sha256(kanonisch(zeile)) !== glied.inhaltHash ||
    sha256(zeile.inhalt) !== zeile.inhaltHash
  )
    return { ergebnis: "abweichung", grund: "abschluss" };
  const inhalt = JSON.parse(zeile.inhalt) as Monatsinhalt;
  const tage = abweichendeTage(
    inhalt.tage,
    aufzeichnungenJetzt(db, betriebId, zeile.nutzerId, zeile.monat),
  );
  return {
    ergebnis: tage.length === 0 ? "uebereinstimmend" : "abweichung",
    grund: tage.length === 0 ? null : "tage",
    nutzerId: zeile.nutzerId,
    monat: zeile.monat,
    abgeschlossenAm: zeile.erstelltAm,
    tage,
    gegeneintraege: gegeneintraegeVon(db, betriebId, zeile.nutzerId, { monat: zeile.monat }).map(
      ({ tag, minuten, grund, am }) => ({ tag, minuten, grund, am }),
    ),
  };
};
