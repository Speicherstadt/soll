import {
  beginnInBerlin,
  jahrVon,
  letzterTag,
  type Monat,
  type PlanBefund,
  type PlanPruefung,
  planBefunde,
  type Standort,
  type Tag,
  tagAus,
  tagInBerlin,
} from "@soll/arbeitszeit";
import { and, eq, gte } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { schichten } from "../../db/schema.ts";
import { istTage, modellAm, sollAm } from "../arbeitszeit/index.ts";
import { betriebLesen, planBetriebAus, pruefeinstellungenVon } from "../betrieb/index.ts";
import { angabenLesen, planPersonAus } from "../personen/index.ts";
import { standorteLesen } from "../standorte/index.ts";
import type { Schicht } from "./schichten.ts";

/** A finding of the plan for one person (S-502): what the week shows on a block and in its list */
export type WochenBefund = PlanBefund & { nutzerId: string };

/** A person's shifts from a day on, at every site of the business: all of them are working time */
const schichtenAb = (db: Db, betriebId: string, nutzerId: string, von: Tag): Schicht[] =>
  db
    .select()
    .from(schichten)
    .where(
      and(
        eq(schichten.betriebId, betriebId),
        eq(schichten.nutzerId, nutzerId),
        gte(schichten.tag, von),
      ),
    )
    .orderBy(schichten.beginn)
    .all();

/** The model of a person as the rules read it: wage, contractual weekly time, agreed daily duration */
const ausModell = (db: Db, betriebId: string, nutzerId: string) => ({
  lohnAm: (monat: Monat) => {
    const modell = modellAm(db, betriebId, nutzerId, letzterTag(monat));
    if (!modell || modell.lohnCent === null) return null;
    return { lohn: { art: modell.lohnArt, cent: modell.lohnCent }, minijob: modell.minijob };
  },
  wochenarbeitszeitAm: (tag: Tag) => {
    const modell = modellAm(db, betriebId, nutzerId, tag);
    return modell ? modell.sollMinuten.reduce((summe, minuten) => summe + minuten, 0) : null;
  },
  tagesdauerAm: (tag: Tag) => {
    const soll = sollAm(db, betriebId, nutzerId, tag);
    return soll ? soll : null;
  },
});

/**
 * The input of the check for one person: the stamps from 1 January of last year up to now (R-06
 * and R-08 count over the calendar year; a shift of yesterday ends with this morning's stamp, § 5
 * ArbZG measures the rest from it), the planned shifts from today on, the settings of the
 * business, the person's data and model. Mitteilung of a shift is the day it was published (S-503);
 * a draft is told today at the earliest (docs/plan.md, "Mitteilung bei Arbeit auf Abruf").
 */
const pruefungFuer = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  standort: Standort,
  jetzt: number,
): PlanPruefung | null => {
  const heute = tagInBerlin(jetzt);
  const betrieb = betriebLesen(db, betriebId);
  if (!betrieb) return null;
  const geplant = schichtenAb(db, betriebId, nutzerId, heute);
  const veroeffentlicht = new Map(geplant.map((s) => [s.schichtId, s.veroeffentlichtAm]));
  const von = beginnInBerlin(tagAus(jahrVon(heute) - 1, 1, 1));
  return {
    schichten: geplant,
    ist: istTage(db, betriebId, nutzerId, von, jetzt),
    heute,
    standort,
    betrieb: planBetriebAus(pruefeinstellungenVon(betrieb)),
    person: planPersonAus(angabenLesen(db, betriebId, nutzerId)),
    ...ausModell(db, betriebId, nutzerId),
    mitteilungAm: (schicht) => {
      const am = veroeffentlicht.get(schicht.schichtId);
      return am == null ? heute : tagInBerlin(am);
    },
  };
};

/**
 * The findings of the plan that concern the shifts shown (S-502): for each person planned among
 * them, the rules on what was worked and what is planned, with the holidays of the site of the week.
 * Days before today are the record of times, not the plan; a week that lies wholly before today has
 * no findings here. Findings warn, they never block a shift (docs/plan.md, "Befunde im Plan").
 */
export const wochenBefunde = (
  db: Db,
  betriebId: string,
  standortId: string,
  gezeigt: readonly Schicht[],
  jetzt: number,
): WochenBefund[] => {
  const heute = tagInBerlin(jetzt);
  const ort = standorteLesen(db, betriebId).find((s) => s.standortId === standortId);
  if (!ort) return [];
  const standort: Standort = { land: ort.land, regionen: ort.regionen };
  const ids = new Set(gezeigt.filter((s) => s.tag >= heute).map((s) => s.schichtId));
  const personen = new Set(
    gezeigt.flatMap((s) => (s.nutzerId && ids.has(s.schichtId) ? [s.nutzerId] : [])),
  );
  return [...personen].flatMap((nutzerId) => {
    const pruefung = pruefungFuer(db, betriebId, nutzerId, standort, jetzt);
    if (!pruefung) return [];
    return planBefunde(pruefung)
      .befunde.map((befund) => ({
        ...befund,
        nutzerId,
        schichtIds: befund.schichtIds.filter((id) => ids.has(id)),
      }))
      .filter((befund) => befund.schichtIds.length > 0);
  });
};
