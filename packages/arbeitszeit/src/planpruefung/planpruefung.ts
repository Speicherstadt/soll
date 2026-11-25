import type { Befund } from "../befund.ts";
import type { PlanSchicht } from "../dienstplan/typen.ts";
import { feiertage } from "../feiertage/feiertage.ts";
import type { Standort } from "../feiertage/laender.ts";
import { jahrVon, plusTage, type Tag } from "../kalender/tag.ts";
import { beginnInBerlin } from "../kalender/zeit.ts";
import { type ArbzgOptionen, arbzgBefunde } from "../pruefung/arbzg.ts";
import type { Ausgleichszeitraum } from "../pruefung/ausgleichszeitraum.ts";
import type { Branche } from "../pruefung/grenzen.ts";
import { nachTag, type Pruefergebnis, type PruefTag, sortiert } from "../pruefung/typen.ts";
import { bereitschaftBefunde } from "../pruefung-bereitschaft/bereitschaft.ts";
import type { BereitschaftsTag } from "../pruefung-bereitschaft/typen.ts";
import { jugendBefunde } from "../pruefung-jugend/jugend.ts";
import { mutterschutzBefunde } from "../pruefung-mutterschutz/mutterschutz.ts";
import type { Tagesspanne } from "../pruefung-mutterschutz/typen.ts";
import { nachtSonntagBefunde } from "../pruefung-nacht-sonntag/nacht-sonntag.ts";
import type { Sonntagsausnahme } from "../pruefung-nacht-sonntag/sonntagsruhe.ts";
import { abrufBefunde } from "./abruf.ts";
import { mitPlanBereitschaft, type PlanBereitschaft } from "./bereitschaft.ts";
import { type LohnAm, lohnBefunde } from "./lohnmonate.ts";
import { planTage } from "./plantage.ts";

/** The settings of the business the rules read; each default is never less strict than the law */
export type PlanBetrieb = {
  /** § 5 Abs. 2 ArbZG; default "andere" */
  branche?: Branche;
  /** §§ 10, 13 ArbZG; default none */
  ausnahmen?: readonly Sonntagsausnahme[];
  /** § 3 Satz 2 ArbZG; default "beide" from AUSGLEICH_BEGINN */
  zeitraum?: Ausgleichszeitraum;
  beginn?: Tag;
};

/**
 * What the rules need of the person, and nothing more (docs/plan.md, "Daten zur Person"): the birth
 * date for the JArbSchG, Wechselschicht for § 2 Abs. 5 Nr. 1 ArbZG, Arbeit auf Abruf for § 12 TzBfG
 * and the spans of the Mutterschutz, without saying whether pregnant or breastfeeding
 */
export type PlanPerson = {
  geburtsdatum?: Tag | null;
  wechselschicht?: boolean;
  abruf?: boolean;
  mutterschutz?: readonly Tagesspanne[];
};

export type PlanPruefung = PlanBereitschaft & {
  /** one person's planned shifts, at any site */
  schichten: readonly PlanSchicht[];
  /** the person's working days from the stamps; only the days before `heute` are read */
  ist: readonly PruefTag[];
  /** the Berlin day: what lies before was worked, from it on the plan holds */
  heute: Tag;
  /** the site whose holidays apply */
  standort: Standort;
  betrieb: PlanBetrieb;
  person: PlanPerson;
  /** the wage of a month from the model in force (R-14, R-32) */
  lohnAm?: LohnAm;
  /** the contractual weekly time in minutes on a day (§ 4 Abs. 1 Satz 4 MuSchG) */
  wochenarbeitszeitAm?: (tag: Tag) => number | null;
  /** the daily duration the contract agrees on a day, null when none (§ 12 Abs. 1 Satz 4 TzBfG) */
  tagesdauerAm?: (tag: Tag) => number | null;
  /** the day a shift's time was told (§ 12 Abs. 3 Satz 2 TzBfG): published, else today */
  mitteilungAm: (schicht: PlanSchicht) => Tag;
};

/** A finding of the plan with the planned shifts it concerns */
export type PlanBefund = Befund & { schichtIds: string[] };

/** The holidays at the site in every year the days touch, for R-03 */
const feiertageIn = (tage: readonly PruefTag[], standort: Standort): Set<Tag> => {
  const jahre = tage.map((tag) => jahrVon(tag.tag));
  const liste: Tag[] = [];
  for (let jahr = Math.min(...jahre); jahr <= Math.max(...jahre); jahr += 1) {
    const ergebnis = feiertage(jahr, standort);
    if (ergebnis.ok) liste.push(...ergebnis.feiertage.map((feiertag) => feiertag.tag));
  }
  return new Set(liste);
};

/**
 * The planned shifts a finding concerns: those of the days it names; for a finding that names only
 * days already worked but the days a remedy may lie on (R-09: `von` to `bis`, the period of the
 * Ersatzruhetag, § 11 Abs. 3 ArbZG), the planned shifts in that period, which take the free days away
 */
const betroffeneSchichten = (befund: Befund, tagVon: ReadonlyMap<string, Tag>): string[] => {
  const genannt = [...tagVon].filter(([, tag]) => befund.tage.includes(tag));
  if (genannt.length > 0) return genannt.map(([schichtId]) => schichtId);
  const { von, bis } = befund as { von?: unknown; bis?: unknown };
  if (typeof von !== "string" || typeof bis !== "string") return [];
  return [...tagVon].filter(([, tag]) => tag >= von && tag <= bis).map(([schichtId]) => schichtId);
};

/**
 * §§ 3 to 5 ArbZG; with Bereitschaft on the days R-11 and R-12 through `bereitschaftBefunde`, which
 * reads days of S-206 and gives the findings of §§ 3 to 5 with them (S-505)
 */
const arbeitszeitRegeln = (
  tage: readonly PruefTag[],
  optionen: ArbzgOptionen & { jetzt: number },
  mitBereitschaft: boolean,
): Pruefergebnis<Befund> =>
  mitBereitschaft
    ? bereitschaftBefunde(tage as readonly BereitschaftsTag[], optionen)
    : arbzgBefunde(tage, optionen);

/** Every rule of Phase 2 that reads planned shifts, on one person's days (BAULISTE.md, S-502) */
const alleRegeln = (
  pruefung: PlanPruefung,
  tage: readonly PruefTag[],
  geplant: readonly Tag[],
  jetzt: number,
  mitBereitschaft: boolean,
): Pruefergebnis<Befund>[] => {
  const { standort, betrieb, person } = pruefung;
  const ausnahmen = betrieb.ausnahmen ?? [];
  const optionen = {
    jetzt,
    feiertage: feiertageIn(tage, standort),
    neutral: new Set<Tag>(),
    ...(betrieb.zeitraum ? { zeitraum: betrieb.zeitraum } : {}),
    ...(betrieb.beginn ? { beginn: betrieb.beginn } : {}),
    ...(betrieb.branche ? { branche: betrieb.branche } : {}),
  };
  const ergebnisse: Pruefergebnis<Befund>[] = [
    arbeitszeitRegeln(tage, optionen, mitBereitschaft),
    nachtSonntagBefunde(tage, {
      jetzt,
      standort,
      ausnahmen,
      wechselschicht: person.wechselschicht ?? false,
    }),
    lohnBefunde(tage, geplant, pruefung.lohnAm),
  ];
  if (person.geburtsdatum) {
    ergebnisse.push(jugendBefunde(tage, { geburtsdatum: person.geburtsdatum, standort }));
  }
  if (person.mutterschutz && person.mutterschutz.length > 0) {
    ergebnisse.push(
      mutterschutzBefunde(tage, {
        zeitraeume: person.mutterschutz,
        geburtsdatum: person.geburtsdatum ?? null,
        standort,
        jetzt,
        ausnahmen,
        ...(pruefung.wochenarbeitszeitAm
          ? { wochenarbeitszeitAm: pruefung.wochenarbeitszeitAm }
          : {}),
      }),
    );
  }
  if (person.abruf) {
    ergebnisse.push(
      abrufBefunde(
        pruefung.schichten
          .filter((schicht) => schicht.tag >= pruefung.heute)
          .map((schicht) => ({
            ...schicht,
            mitteilung: pruefung.mitteilungAm(schicht),
            tagesdauer: pruefung.tagesdauerAm?.(schicht.tag) ?? null,
          })),
      ),
    );
  }
  return ergebnisse;
};

/**
 * The findings of one person's plan (S-502): the rules of Phase 2 that read shifts, on the days
 * worked before today and the days planned from today on, as if the plan were worked up to the last
 * minute of its last day. Only findings that concern a planned shift are returned, each with the
 * shifts of the days it names; a finding about the past alone belongs to the record of times, not
 * the plan. No rule is implemented twice: each comes from its own module. With Rufbereitschaft
 * (S-505) R-11 and R-12 join, and a finding also names the planned duties of the days it names that
 * count as working time.
 */
export const planBefunde = (pruefung: PlanPruefung): Pruefergebnis<PlanBefund> => {
  const {
    tage,
    tagVon: schichtTag,
    rufdienstTag,
    mitBereitschaft,
  } = mitPlanBereitschaft(
    planTage(pruefung.schichten, pruefung.ist, pruefung.heute),
    pruefung.heute,
    new Map(pruefung.schichten.map((schicht) => [schicht.schichtId, schicht.beginn])),
    pruefung,
  );
  const tagVon = new Map([...schichtTag, ...rufdienstTag]);
  const geplant = sortiert(tagVon.values());
  const letzter = geplant.at(-1);
  if (letzter === undefined) return { befunde: [], nichtHinterlegt: [] };
  const jetzt = beginnInBerlin(plusTage(letzter, 1)) - 60_000;
  const ergebnisse = alleRegeln(pruefung, tage, geplant, jetzt, mitBereitschaft);
  const befunde = nachTag(ergebnisse.flatMap((ergebnis) => ergebnis.befunde)).flatMap((befund) => {
    const schichtIds = betroffeneSchichten(befund, tagVon);
    const abruf = (befund as { schichtId?: string }).schichtId;
    const betroffen = abruf ? [abruf] : schichtIds;
    return betroffen.length > 0 ? [{ ...befund, schichtIds: betroffen }] : [];
  });
  const nichtHinterlegt = sortiert(
    ergebnisse
      .flatMap((ergebnis) => ergebnis.nichtHinterlegt)
      .filter((tag) => tag >= pruefung.heute),
  );
  return { befunde, nichtHinterlegt };
};
