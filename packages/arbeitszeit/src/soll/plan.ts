import { schichtMinuten } from "../dienstplan/zeiten.ts";
import type { PlanSchicht } from "../dienstplan/typen.ts";
import type { Tag } from "../kalender/tag.ts";

/**
 * Where the Soll of a business comes from from a day on (S-505): the working-time model, or the
 * published plan. A list in the order of their days; the entry on or before a day decides it.
 */
export type Sollquelle = { ab: Tag; quelle: "modell" | "plan" };

/** The source in force on a day: the latest entry on or before it, the model without one */
export const sollquelleAm = (quellen: readonly Sollquelle[], tag: Tag): Sollquelle["quelle"] =>
  [...quellen]
    .filter((eintrag) => eintrag.ab <= tag)
    .sort((a, b) => a.ab.localeCompare(b.ab))
    .at(-1)?.quelle ?? "modell";

/**
 * The planned minutes of a person per working day (the day a shift begins on, CLAUDE.md "Time"):
 * real minutes from beginning to end without the break, so a night shift 22:00 to 6:00 has 7 or 9
 * hours in the nights the clocks change. Pass only published shifts: a draft is no instruction yet
 * (S-503). A break longer than its shift gives no negative Soll.
 */
export const planMinutenJeTag = (schichten: readonly PlanSchicht[]): Map<Tag, number> => {
  const jeTag = new Map<Tag, number>();
  for (const schicht of schichten) {
    const minuten = Math.max(0, schichtMinuten(schicht));
    jeTag.set(schicht.tag, (jeTag.get(schicht.tag) ?? 0) + minuten);
  }
  return jeTag;
};

/**
 * The days of a span whose Soll comes from the plan, each with its planned minutes (0 when nothing
 * is planned): what `SollGrundlagen.plan` takes
 */
export const planSoll = (
  tage: readonly Tag[],
  quellen: readonly Sollquelle[],
  schichten: readonly PlanSchicht[],
): Map<Tag, number> => {
  const minuten = planMinutenJeTag(schichten);
  return new Map(
    tage
      .filter((tag) => sollquelleAm(quellen, tag) === "plan")
      .map((tag) => [tag, minuten.get(tag) ?? 0] as const),
  );
};
