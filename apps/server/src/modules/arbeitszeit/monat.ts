import {
  type Arbeitstag,
  arbeitstage,
  ausgleichszeitraum,
  type Befund,
  type Beschaeftigung,
  ersterTag,
  feiertage,
  hoechstarbeitszeit,
  letzterTag,
  type Monat,
  monatsstand,
  monatVon,
  ruhepausen,
  ruhezeit,
  type Standort,
  type Tag,
  tagInBerlin,
} from "@soll/arbeitszeit";
import { and, eq, gte, lte, min } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { korrekturen, modellzuordnungen, stempelungen } from "../../db/schema.ts";
import { betriebLesen } from "../betrieb/index.ts";
import { mitgliedschaftVon } from "../mitglieder/index.ts";
import { standorteLesen } from "../standorte/index.ts";
import {
  type Aufzeichnung,
  aufzeichnungen,
  type Gegeneintrag,
  lesefenster,
  type Monatsinhalt,
  monatsinhalt,
  type Summen,
} from "./monatsinhalt.ts";
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

/** The records of a month now: what the check page compares with the month as closed */
export const aufzeichnungenJetzt = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  monat: Monat,
): Aufzeichnung[] =>
  aufzeichnungen(monat, stempelDesMonats(db, betriebId, nutzerId, monat), (tag) =>
    sollAm(db, betriebId, nutzerId, tag),
  );

/**
 * The holidays of a person come from the business's first site, else from its Land; a site per
 * person follows with the shift plan (docs/plan.md, "Feiertage im Monatsabschluss")
 */
export const standortVon = (db: Db, betriebId: string): Standort | null => {
  const [erster] = standorteLesen(db, betriebId);
  if (erster) return { land: erster.land, regionen: erster.regionen };
  const land = betriebLesen(db, betriebId)?.land;
  return land ? ({ land } as Standort) : null;
};

/**
 * The employment as Soll knows it: from the first of joining the business, the first stamp and the
 * first model; Soll has no date of leaving yet (docs/plan.md, "Beschäftigung im Monatsabschluss")
 */
const beschaeftigungVon = (db: Db, betriebId: string, nutzerId: string): Beschaeftigung | null => {
  const seit = mitgliedschaftVon(db, betriebId, nutzerId)?.seit;
  const ersterStempel = db
    .select({ zeitpunkt: min(stempelungen.zeitpunkt) })
    .from(stempelungen)
    .where(and(eq(stempelungen.betriebId, betriebId), eq(stempelungen.nutzerId, nutzerId)))
    .get()?.zeitpunkt;
  const ersteZuordnung = db
    .select({ tag: min(modellzuordnungen.gueltigAb) })
    .from(modellzuordnungen)
    .where(
      and(eq(modellzuordnungen.betriebId, betriebId), eq(modellzuordnungen.nutzerId, nutzerId)),
    )
    .get()?.tag;
  const tage = [
    seit == null ? null : tagInBerlin(seit),
    ersterStempel == null ? null : tagInBerlin(ersterStempel),
    ersteZuordnung ?? null,
  ].filter((tag): tag is Tag => tag !== null);
  const [eintritt] = tage.sort();
  return eintritt === undefined ? null : { eintritt };
};

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
 * R-01 from the stamps, R-02, R-04 and R-05 as the day view checks them (S-304), and R-03 over the
 * periods that reach into the month (docs/stempeln.md: the Ausgleichszeitraum comes with closing);
 * absences are no data yet (S-401), so no day is neutral
 */
const befundeDesMonats = (
  tage: readonly Arbeitstag[],
  monat: Monat,
  jetzt: number,
  feiertageAmOrt: ReadonlySet<Tag>,
): Befund[] =>
  [
    ...tage.flatMap((tag) => tag.befunde),
    ...hoechstarbeitszeit(tage).befunde,
    ...ausgleichszeitraum(tage, { jetzt, feiertage: feiertageAmOrt, neutral: new Set() }).befunde,
    ...ruhepausen(tage).befunde,
    ...ruhezeit(tage, { jetzt }).befunde,
  ].filter((befund) => befund.tage.some((tag) => monatVon(tag) === monat));

/** Soll and Ist; null with the days that lack a model or the holidays ("nicht hinterlegt") */
const summenDesMonats = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  monat: Monat,
  tage: readonly Arbeitstag[],
  aufzeichnung: readonly Aufzeichnung[],
): { summen: Summen | null; nichtHinterlegt: Tag[] } => {
  const ohneModell = aufzeichnung.filter((tag) => tag.modellMinuten === null).map((t) => t.tag);
  const standort = standortVon(db, betriebId);
  const beschaeftigung = beschaeftigungVon(db, betriebId, nutzerId);
  if (standort === null || beschaeftigung === null)
    return { summen: null, nichtHinterlegt: aufzeichnung.map((tag) => tag.tag) };
  const stand = monatsstand(monat, {
    modelle: modellabschnitte(db, betriebId, nutzerId),
    standort,
    beschaeftigung,
    arbeitstage: tage,
  });
  if (!stand.ok)
    return {
      summen: null,
      nichtHinterlegt: stand.grund === "nicht_hinterlegt" ? stand.tage : ohneModell,
    };
  // a day of the employment without a model is never counted as 0 (CLAUDE.md, "Never")
  const fehlend = ohneModell.filter((tag) => tag >= beschaeftigung.eintritt);
  if (fehlend.length > 0) return { summen: null, nichtHinterlegt: fehlend };
  const { sollMinuten, gearbeitetMinuten, gutschriftMinuten, istMinuten, saldoMinuten } =
    stand.wert;
  return {
    summen: { sollMinuten, gearbeitetMinuten, gutschriftMinuten, istMinuten, saldoMinuten },
    nichtHinterlegt: [],
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
  const ergebnis = arbeitstage(stempel, jetzt);
  const alle = ergebnis.ok ? ergebnis.wert : [];
  const tage = aufzeichnungen(monat, stempel, (tag) => sollAm(db, betriebId, nutzerId, tag));
  const imMonat = alle.filter((tag) => monatVon(tag.tag) === monat);
  const gegeneintraege = gegeneintraegeVon(db, betriebId, nutzerId, { gebuchtIn: monat });
  const { summen, nichtHinterlegt } = summenDesMonats(
    db,
    betriebId,
    nutzerId,
    monat,
    imMonat,
    tage,
  );
  return {
    inhalt: monatsinhalt({
      monat,
      nutzerId,
      tage,
      summen: summen && mitGegeneintraegen(summen, gegeneintraege),
      nichtHinterlegt,
      befunde: befundeDesMonats(alle, monat, jetzt, feiertageUm(standortVon(db, betriebId), monat)),
      gegeneintraege,
    }),
    // a day with a shift still open; a stamp without Kommen opens none (it is an R-01 finding)
    offeneTage: imMonat
      .filter((tag) => tag.schichten.some((schicht) => schicht.offen !== null))
      .map((tag) => tag.tag),
  };
};
