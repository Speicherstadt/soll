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

/** What the Soll of a day needs: the person's models, the place for holidays, the employment */
export type SollGrundlagen = {
  modelle: readonly Modellabschnitt[];
  standort: Standort;
  beschaeftigung: Beschaeftigung;
  /**
   * Days whose Soll comes from the published shift plan (S-505), in whole minutes (0 when nothing
   * is planned on that day); a day absent from the map uses the working-time model
   */
  plan?: ReadonlyMap<Tag, number>;
};

export type TagesSoll = {
  tag: Tag;
  /** the model's or plan's minutes for the day; 0 outside the employment and while it rests */
  modellMinuten: number;
  /** true when this day's Soll came from the published shift plan instead of the model */
  ausPlan?: true;
  /** the holiday at the place, looked up only on a day with model minutes */
  feiertag: Feiertag | null;
  /** the model's minutes a holiday takes (§ 2 Abs. 1 EntgFG), e.g. for § 4 Abs. 4 Satz 2 JArbSchG */
  ausfallMinuten: number;
  /** the day's target minutes, 0 on a holiday for model-based days (§ 2 Abs. 1 EntgFG) */
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

/** The model's or plan's minutes of a day, 0 outside the employment, null without a model ("nicht hinterlegt") */
const sollBasisAm = (
  grundlagen: SollGrundlagen,
  tag: Tag,
): { minuten: number | null; ausPlan: boolean } | null => {
  if (!beschaeftigtAm(grundlagen.beschaeftigung, tag)) return { minuten: 0, ausPlan: false };
  if (grundlagen.plan?.has(tag)) {
    const geplant = grundlagen.plan.get(tag) ?? 0;
    if (!Number.isSafeInteger(geplant) || geplant < 0) return null;
    return { minuten: geplant, ausPlan: true };
  }
  const modell = modellAm(grundlagen.modelle, tag);
  return {
    minuten: modell === null ? null : minutenAmWochentag(modell.sollMinuten, tag),
    ausPlan: false,
  };
};

const bescheinigungFehlt = (tag: Tag): KrankImUrlaubBefund => ({
  regel: "R-24",
  norm: "§ 9 BUrlG",
  schwere: "hinweis",
  art: "bescheinigung_fehlt",
  tage: [tag],
});

/**
 * The Soll of one day from the model in force on it or from the published shift plan (S-505), with
 * the absences of that day: on model-based days a holiday at the place takes the Soll (§ 2 Abs. 1
 * EntgFG); on plan-based days the published plan already states whether a shift is owed on the
 * holiday. An absence keeps the Soll and is credited to Ist (Ausfallprinzip, § 4 Abs. 1 EntgFG);
 * leave is charged only on a day with Soll. A day of the employment without a model (and not from
 * the plan), or with model minutes in a year without holidays, is "nicht hinterlegt"; never the
 * value of another model or year.
 */
export const tagesSoll = (
  tag: Tag,
  grundlagen: SollGrundlagen,
  abwesenheiten: readonly Abwesenheit[] = [],
): TagesSollErgebnis => {
  if (!istTag(tag)) return { ok: false, grund: "ungueltig" };
  const basis = sollBasisAm(grundlagen, tag);
  if (basis === null) return { ok: false, grund: "ungueltig" };
  if (basis.minuten === null) return { ok: false, grund: "nicht_hinterlegt" };
  const { minuten: modellMinuten, ausPlan } = basis;
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
