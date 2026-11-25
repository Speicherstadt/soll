import type { Befund } from "../befund.ts";
import { type Feiertag, feiertagAm } from "../feiertage/feiertage.ts";
import type { Standort } from "../feiertage/laender.ts";
import { istTag, type Tag } from "../kalender/tag.ts";
import { inSpanne } from "../pruefung-mutterschutz/typen.ts";
import { abwesenheitenAufloesen, gutschrift, urlaubAmTag } from "./abwesenheit.ts";
import { minutenAmWochentag, modellAm } from "./modell.ts";
import type { Abwesenheit, Beschaeftigung, Modellabschnitt } from "./typen.ts";

/** R-24: sickness on a leave day without a certificate; the day counts as leave */
export type KrankImUrlaubBefund = Befund<"bescheinigung_fehlt">;

/**
 * What the Soll of a day needs: the person's models, the place for holidays, the employment, and
 * the days whose Soll comes from the published plan with their planned minutes (S-505, `planSoll`)
 */
export type SollGrundlagen = {
  modelle: readonly Modellabschnitt[];
  standort: Standort;
  beschaeftigung: Beschaeftigung;
  plan?: ReadonlyMap<Tag, number>;
};

export type TagesSoll = {
  tag: Tag;
  /**
   * the model's minutes for the weekday, or on a day of the plan its planned minutes; 0 outside
   * the employment and while it rests
   */
  modellMinuten: number;
  /** true on a day whose Soll comes from the published plan (S-505) */
  ausPlan?: true;
  /** the holiday at the place, looked up only on a day with model minutes */
  feiertag: Feiertag | null;
  /** the model's minutes a holiday takes (§ 2 Abs. 1 EntgFG), e.g. for § 4 Abs. 4 Satz 2 JArbSchG */
  ausfallMinuten: number;
  /** the model's minutes, 0 on a holiday (§ 2 Abs. 1 EntgFG: the time is paid, not owed) */
  sollMinuten: number;
  /** the absences as they count (§ 9 BUrlG) */
  abwesenheiten: Abwesenheit[];
  /** the minutes credited to Ist for the absences */
  gutschriftMinuten: number;
  /** the leave charged, in half days */
  urlaubHalbtage: number;
  befunde: KrankImUrlaubBefund[];
};

export type TagesSollErgebnis =
  | { ok: true; wert: TagesSoll }
  | { ok: false; grund: "nicht_hinterlegt" | "ungueltig" };

const beschaeftigtAm = (beschaeftigung: Beschaeftigung, tag: Tag): boolean =>
  beschaeftigung.eintritt <= tag &&
  (beschaeftigung.austritt == null || tag <= beschaeftigung.austritt) &&
  !inSpanne(beschaeftigung.ruhend ?? [], tag);

/** The model's minutes of a day, 0 outside the employment, null without a model ("nicht hinterlegt") */
const modellMinutenAm = (grundlagen: SollGrundlagen, tag: Tag): number | null => {
  if (!beschaeftigtAm(grundlagen.beschaeftigung, tag)) return 0;
  const geplant = grundlagen.plan?.get(tag);
  if (geplant !== undefined) return geplant;
  const modell = modellAm(grundlagen.modelle, tag);
  return modell === null ? null : minutenAmWochentag(modell.sollMinuten, tag);
};

const bescheinigungFehlt = (tag: Tag): KrankImUrlaubBefund => ({
  regel: "R-24",
  norm: "§ 9 BUrlG",
  schwere: "hinweis",
  art: "bescheinigung_fehlt",
  tage: [tag],
});

/**
 * The Soll of one day from the model in force on it (docs/plan.md, "Soll eines Tages"), with the
 * absences of that day: a holiday at the place takes the Soll (§ 2 Abs. 1 EntgFG), an absence keeps
 * it and is credited to Ist, leave is charged only on a day with Soll. A day of the employment
 * without a model, or with model minutes in a year without holidays, is "nicht hinterlegt"; never
 * the value of another model or year (CLAUDE.md, "Never"). On a day of the plan (S-505) the
 * published plan is the Soll, a holiday included: a shift planned on it is owed, a holiday without
 * one owes nothing, and an absence is credited what the plan held (Ausfallprinzip, § 4 Abs. 1 EntgFG).
 */
export const tagesSoll = (
  tag: Tag,
  grundlagen: SollGrundlagen,
  abwesenheiten: readonly Abwesenheit[] = [],
): TagesSollErgebnis => {
  if (!istTag(tag)) return { ok: false, grund: "ungueltig" };
  const modellMinuten = modellMinutenAm(grundlagen, tag);
  if (modellMinuten === null) return { ok: false, grund: "nicht_hinterlegt" };
  const ausPlan = beschaeftigtAm(grundlagen.beschaeftigung, tag) && grundlagen.plan?.has(tag);
  const nachschlag = modellMinuten > 0 && !ausPlan ? feiertagAm(tag, grundlagen.standort) : null;
  if (nachschlag !== null && !nachschlag.ok)
    return { ok: false, grund: nachschlag.grund === "kein_tag" ? "ungueltig" : "nicht_hinterlegt" };
  const aufgeloest = abwesenheitenAufloesen(abwesenheiten.filter((a) => a.tag === tag));
  if (aufgeloest === null) return { ok: false, grund: "ungueltig" };
  const feiertag = nachschlag?.feiertag ?? null;
  const sollMinuten = feiertag === null ? modellMinuten : 0;
  const urlaubHalbtage = urlaubAmTag(aufgeloest.liste, sollMinuten);
  return {
    ok: true,
    wert: {
      tag,
      modellMinuten,
      ...(ausPlan ? { ausPlan: true as const } : {}),
      feiertag,
      ausfallMinuten: modellMinuten - sollMinuten,
      sollMinuten,
      abwesenheiten: aufgeloest.liste,
      gutschriftMinuten: gutschrift(aufgeloest.liste, sollMinuten),
      urlaubHalbtage,
      befunde: aufgeloest.ohneBescheinigung && urlaubHalbtage > 0 ? [bescheinigungFehlt(tag)] : [],
    },
  };
};
