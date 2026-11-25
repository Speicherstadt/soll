import { m } from "../paraglide/messages.js";
import type { PlanBefund } from "./typen.ts";

/*
 * What the plan says of a finding, in the language of the app; the norm stays German as the server
 * names it (CLAUDE.md, "Working rules"). One title per rule: the norm tells the paragraph.
 */

const REGEL_TITEL: Record<string, () => string> = {
  "R-11": m.plan_regel_r11,
  "R-12": m.plan_regel_r12,
  "R-02": m.plan_regel_r02,
  "R-03": m.plan_regel_r03,
  "R-04": m.plan_regel_r04,
  "R-05": m.plan_regel_r05,
  "R-06": m.plan_regel_r06,
  "R-07": m.plan_regel_r07,
  "R-08": m.plan_regel_r08,
  "R-09": m.plan_regel_r09,
  "R-14": m.plan_regel_r14,
  "R-15": m.plan_regel_r15,
  "R-16": m.plan_regel_r16,
  "R-17": m.plan_regel_r17,
  "R-18": m.plan_regel_r18,
  "R-19": m.plan_regel_r19,
  "R-20": m.plan_regel_r20,
  "R-21": m.plan_regel_r21,
  "R-22": m.plan_regel_r22,
  "R-32": m.plan_regel_r32,
};

export const befundTitel = (befund: PlanBefund): string =>
  (REGEL_TITEL[befund.regel] ?? m.plan_regel_sonst)();

export const schwereText = (befund: PlanBefund): string =>
  befund.schwere === "verstoss" ? m.befund_verstoss() : m.befund_hinweis();

/** "Verstoß: Ruhezeit zu kurz · § 5 Abs. 1 ArbZG" for a block's icon and tooltip */
export const befundKurz = (befund: PlanBefund): string =>
  `${schwereText(befund)}: ${befundTitel(befund)} · ${befund.norm}`;

/** The findings of one shift, a Verstoß first */
export const befundeDer = (
  befunde: readonly PlanBefund[] | null,
  schichtId: string,
): PlanBefund[] =>
  (befunde ?? [])
    .filter((befund) => befund.schichtIds.includes(schichtId))
    .sort((a, b) => (a.schwere === b.schwere ? 0 : a.schwere === "verstoss" ? -1 : 1));
