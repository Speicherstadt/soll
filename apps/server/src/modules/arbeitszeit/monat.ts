import {
  type Abwesenheit,
  type Arbeitstag,
  arbeitstage,
  ausgleichszeitraum,
  type Befund,
  type BereitschaftEingabe,
  bereitschaftBefunde,
  bereitschaftstage,
  ersterTag,
  feiertage,
  hoechstarbeitszeit,
  letzterTag,
  type Monat,
  monatsstand,
  monatVon,
  type PruefTag,
  ruhepausen,
  ruhezeit,
  type Standort,
  type Tag,
  tagInBerlin,
} from "@soll/arbeitszeit";
import { and, eq, gte, lte } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { korrekturen } from "../../db/schema.ts";
import { rufdiensteVon } from "../plandaten/index.ts";
import { abwesenheitstage } from "./abwesenheiten/lesen.ts";
import { einsaetzeIn } from "./einsaetze.ts";
import { beschaeftigungVon, standortVon } from "./grundlagen.ts";
import {
  type Aufzeichnung,
  aufzeichnungen,
  type Einsatzspanne,
  type Gegeneintrag,
  lesefenster,
  type Monatsinhalt,
  monatsinhalt,
  type Summen,
  type Weitere,
} from "./monatsinhalt.ts";
import { planSollImMonat } from "./sollquellen.ts";
import { stempelungenIn } from "./stempelungen.ts";
import { modellabschnitte, sollAm } from "./zuordnungen.ts";

/*
 * A person's month as the database holds it now, brought into the form of `monatsinhalt` (S-306).
 */

/** The stamps a month is read from (`lesefenster`) */
const stempelDesMonats = (db: Db, betriebId: string, nutzerId: string, monat: Monat) => {
  const { von, bis } = lesefenster(monat);
  return stempelungenIn(db, betriebId, nutzerId, von, bis);
};

/**
 * What a month records besides stamps (S-505): the call-outs of its window and, on the days whose
 * Soll comes from the plan, the person's published minutes
 */
const weitereDesMonats = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  monat: Monat,
): Required<Weitere> & { einsaetze: Einsatzspanne[] } => {
  const { von, bis } = lesefenster(monat);
  return {
    einsaetze: einsaetzeIn(db, betriebId, nutzerId, von, bis).map(({ beginn, ende }) => ({
      beginn,
      ende,
    })),
    plan: planSollImMonat(db, betriebId, nutzerId, monat),
  };
};

/**
 * The approved absences of a month (S-401); an open sickness counts up to today, or to the month's
 * last day once the month is over
 */
const abwesenheitenDesMonats = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  monat: Monat,
  heute: Tag,
): Abwesenheit[] => {
  const ende = letzterTag(monat);
  return abwesenheitstage(
    db,
    betriebId,
    nutzerId,
    ersterTag(monat),
    ende,
    heute < ende ? heute : ende,
  );
};

/**
 * The records of a month now: what the check page compares with the month as closed. It checks
 * months that are over, so an open sickness counts to their last day.
 */
export const aufzeichnungenJetzt = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  monat: Monat,
): Aufzeichnung[] =>
  aufzeichnungen(
    monat,
    stempelDesMonats(db, betriebId, nutzerId, monat),
    (tag) => sollAm(db, betriebId, nutzerId, tag),
    abwesenheitenDesMonats(db, betriebId, nutzerId, monat, letzterTag(monat)),
    weitereDesMonats(db, betriebId, nutzerId, monat),
  );

/** The holidays at the place in the year of the month and the one before, for R-03 */
const feiertageUm = (standort: Standort | null, monat: Monat): Set<Tag> => {
  if (standort === null) return new Set();
  const jahr = Number(monat.slice(0, 4));
  return new Set(
    [jahr - 1, jahr].flatMap((j) => {
      const ergebnis = feiertage(j, standort);
      return ergebnis.ok ? ergebnis.feiertage.map((feiertag) => feiertag.tag) : [];
    }),
  );
};

/**
 * Days of leave and sickness are neutral in the Ausgleichszeitraum (docs/regeln.md R-03): whole days
 * of leave, sickness, Kind krank and Sonderurlaub; taking off overtime is compensation, not neutral
 */
const neutraleTage = (abwesenheiten: readonly Abwesenheit[]): Set<Tag> =>
  new Set(
    abwesenheiten.filter((a) => a.halb !== true && a.art !== "ueberstundenabbau").map((a) => a.tag),
  );

/**
 * §§ 3 to 5 ArbZG on the days with call-outs or published Rufbereitschaft (R-11, R-12, S-505), null
 * without either. The days are those of `arbeitstage`, call-outs read as stamped; the duties that
 * count fully are added, and the rest reads the blocks that are only call-outs apart (R-12).
 */
const mitBereitschaft = (
  tage: readonly Arbeitstag[],
  rufdienste: BereitschaftEingabe["rufdienste"],
  optionen: { jetzt: number; feiertage: ReadonlySet<Tag>; neutral: ReadonlySet<Tag> },
): Befund[] | null => {
  const einsaetze = tage.some((tag) =>
    tag.schichten.some((schicht) => (schicht.einsaetze ?? []).length > 0),
  );
  if (!einsaetze && (rufdienste ?? []).length === 0) return null;
  const ergebnis = bereitschaftstage(tage, { rufdienste: rufdienste ?? [] });
  return ergebnis.ok ? bereitschaftBefunde(ergebnis.wert, optionen).befunde : null;
};

/**
 * R-01 from the stamps, R-02, R-04 and R-05 as the day view checks them (S-304), R-03 over the
 * periods that reach into the month (docs/stempeln.md: the Ausgleichszeitraum comes with closing),
 * with the days of absence of the month neutral (S-401); with call-outs or Rufbereitschaft R-11 and
 * R-12 too (S-505)
 */
const befundeDesMonats = (
  tage: readonly Arbeitstag[],
  monat: Monat,
  optionen: { jetzt: number; feiertage: ReadonlySet<Tag>; neutral: ReadonlySet<Tag> },
  rufdienste: BereitschaftEingabe["rufdienste"],
): Befund[] =>
  [
    ...tage.flatMap((tag) => tag.befunde),
    ...(mitBereitschaft(tage, rufdienste, optionen) ?? [
      ...hoechstarbeitszeit(tage).befunde,
      ...ausgleichszeitraum(tage, optionen).befunde,
      ...ruhepausen(tage).befunde,
      ...ruhezeit(tage, { jetzt: optionen.jetzt }).befunde,
    ]),
  ].filter((befund) => befund.tage.some((tag) => monatVon(tag) === monat));

/** Soll and Ist; null with the days that lack a model or the holidays ("nicht hinterlegt") */
const summenDesMonats = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  monat: Monat,
  tage: readonly PruefTag[],
  aufzeichnung: readonly Aufzeichnung[],
  abwesenheiten: readonly Abwesenheit[],
  plan: ReadonlyMap<Tag, number>,
): { summen: Summen | null; nichtHinterlegt: Tag[]; befunde: Befund[] } => {
  // a day of the plan needs no model: the plan is its Soll (S-505)
  const ohneModell = aufzeichnung
    .filter((tag) => tag.modellMinuten === null && tag.planMinuten === undefined)
    .map((t) => t.tag);
  const standort = standortVon(db, betriebId);
  const beschaeftigung = beschaeftigungVon(db, betriebId, nutzerId);
  if (standort === null || beschaeftigung === null)
    return { summen: null, nichtHinterlegt: aufzeichnung.map((tag) => tag.tag), befunde: [] };
  const stand = monatsstand(monat, {
    modelle: modellabschnitte(db, betriebId, nutzerId),
    standort,
    beschaeftigung,
    arbeitstage: tage,
    abwesenheiten,
    plan,
  });
  if (!stand.ok)
    return {
      summen: null,
      nichtHinterlegt: stand.grund === "nicht_hinterlegt" ? stand.tage : ohneModell,
      befunde: [],
    };
  // a day of the employment without a model is never counted as 0 (CLAUDE.md, "Never")
  const fehlend = ohneModell.filter((tag) => tag >= beschaeftigung.eintritt);
  if (fehlend.length > 0) return { summen: null, nichtHinterlegt: fehlend, befunde: [] };
  const { sollMinuten, gearbeitetMinuten, gutschriftMinuten, istMinuten, saldoMinuten } =
    stand.wert;
  return {
    summen: { sollMinuten, gearbeitetMinuten, gutschriftMinuten, istMinuten, saldoMinuten },
    nichtHinterlegt: [],
    // R-24: sickness without a certificate in leave (§ 9 BUrlG)
    befunde: stand.wert.befunde,
  };
};

/**
 * A counter-entry counts in the month it is entered in (docs/plan.md, "Korrektur nach dem
 * Abschluss"): its minutes go into the Ist and the balance of that month
 */
const mitGegeneintraegen = (summen: Summen, gegeneintraege: readonly Gegeneintrag[]): Summen => {
  const minuten = gegeneintraege.reduce((summe, eintrag) => summe + eintrag.minuten, 0);
  return {
    ...summen,
    istMinuten: summen.istMinuten + minuten,
    saldoMinuten: summen.saldoMinuten + minuten,
  };
};

/** Counter-entries entered in a month (`gebucht_in`) or made to its days (`tag`) */
export const gegeneintraegeVon = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  wo: { gebuchtIn: Monat } | { monat: Monat },
): (Gegeneintrag & { korrekturId: string; von: string; am: number; gebuchtIn: Monat })[] =>
  db
    .select()
    .from(korrekturen)
    .where(
      and(
        eq(korrekturen.betriebId, betriebId),
        eq(korrekturen.nutzerId, nutzerId),
        ...("gebuchtIn" in wo
          ? [eq(korrekturen.gebuchtIn, wo.gebuchtIn)]
          : [
              gte(korrekturen.tag, ersterTag(wo.monat)),
              lte(korrekturen.tag, letzterTag(wo.monat)),
            ]),
      ),
    )
    .orderBy(korrekturen.erstelltAm)
    .all()
    .map((zeile) => ({
      korrekturId: zeile.korrekturId,
      tag: zeile.tag,
      minuten: zeile.minuten,
      grund: zeile.grund,
      von: zeile.erstelltVon,
      am: zeile.erstelltAm,
      gebuchtIn: zeile.gebuchtIn,
    }));

/** A person's month now, with the days whose shift is still open (they block closing) */
export const monatJetzt = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  monat: Monat,
  jetzt: number,
): { inhalt: Monatsinhalt; offeneTage: Tag[] } => {
  const stempel = stempelDesMonats(db, betriebId, nutzerId, monat);
  const weitere = weitereDesMonats(db, betriebId, nutzerId, monat);
  // call-outs are read as the same times stamped: the Ist, the findings and the open shifts that
  // block closing come from one run (R-12, R-29, reviews of S-505)
  const ergebnis = arbeitstage(stempel, jetzt, weitere.einsaetze);
  const alle = ergebnis.ok ? ergebnis.wert : [];
  const abwesenheiten = abwesenheitenDesMonats(db, betriebId, nutzerId, monat, tagInBerlin(jetzt));
  const tage = aufzeichnungen(
    monat,
    stempel,
    (tag) => sollAm(db, betriebId, nutzerId, tag),
    abwesenheiten,
    weitere,
  );
  const imMonat = alle.filter((tag) => monatVon(tag.tag) === monat);
  const gegeneintraege = gegeneintraegeVon(db, betriebId, nutzerId, { gebuchtIn: monat });
  const stand = summenDesMonats(
    db,
    betriebId,
    nutzerId,
    monat,
    imMonat,
    tage,
    abwesenheiten,
    weitere.plan,
  );
  const feiertageAmOrt = feiertageUm(standortVon(db, betriebId), monat);
  const { von, bis } = lesefenster(monat);
  const rufdienste = rufdiensteVon(db, betriebId, nutzerId, tagInBerlin(von), tagInBerlin(bis));
  const optionen = { jetzt, feiertage: feiertageAmOrt, neutral: neutraleTage(abwesenheiten) };
  return {
    inhalt: monatsinhalt({
      monat,
      nutzerId,
      tage,
      summen: stand.summen && mitGegeneintraegen(stand.summen, gegeneintraege),
      nichtHinterlegt: stand.nichtHinterlegt,
      befunde: [
        ...befundeDesMonats(
          alle,
          monat,
          optionen,
          rufdienste.map(({ beginn, ende, reaktionMinuten }) => ({
            beginn,
            ende,
            ...(reaktionMinuten === null ? {} : { reaktionMinuten }),
          })),
        ),
        ...stand.befunde,
      ],
      gegeneintraege,
    }),
    // a day with a shift still open, a running call-out's as an open Kommen's; a stamp without
    // Kommen opens none (R-01)
    offeneTage: imMonat
      .filter((tag) => tag.schichten.some((schicht) => schicht.offen !== null))
      .map((tag) => tag.tag),
  };
};
