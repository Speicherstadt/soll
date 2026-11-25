import type { PlanRufdienst } from "../dienstplan/typen.ts";
import type { Tag } from "../kalender/tag.ts";
import { beginnInBerlin } from "../kalender/zeit.ts";
import type { PruefTag } from "../pruefung/typen.ts";
import { bereitschaftstage, zaehltVoll } from "../pruefung-bereitschaft/bereitschaftstage.ts";
import type { Spanne } from "../pruefung-bereitschaft/typen.ts";
import { arbeitstagMit } from "../pruefung-bereitschaft/zuordnung.ts";
import type { PlanTage } from "./plantage.ts";

/*
 * Rufbereitschaft in the check of the plan (S-505): R-11 and R-12 with the functions of S-206, no
 * second implementation. Before today the call-outs as recorded count, from today on the planned
 * duties; a duty counts fully only under the reaction time of R-12 (or without one, Matzak).
 */

export type PlanBereitschaft = {
  /** the person's planned duties of Rufbereitschaft, at any site */
  rufdienste?: readonly PlanRufdienst[];
  /** the person's recorded call-outs; only those that begin before today are read */
  einsaetze?: readonly Spanne[];
};

export type PlanTageMitBereitschaft = PlanTage & {
  /** the working day each planned duty counts on, for the duties that are working time */
  rufdienstTag: ReadonlyMap<string, Tag>;
  /** true when the days carry Bereitschaft: then R-11 and R-12 judge them */
  mitBereitschaft: boolean;
};

/**
 * The working days of `planTage` with the duties from `heute` on and the call-outs before it, and
 * the working day of every planned shift and duty within them: a duty that counts fully can join a
 * shift and the next one into one working day, as stamped work would (Grundbegriff „Schicht“);
 * a call-out before today is read exactly as the same times worked (`ist`).
 */
export const mitPlanBereitschaft = (
  plan: PlanTage,
  heute: Tag,
  schichtBeginn: ReadonlyMap<string, number>,
  { rufdienste = [], einsaetze = [] }: PlanBereitschaft,
): PlanTageMitBereitschaft => {
  const ab = beginnInBerlin(heute);
  const dienste = rufdienste.filter((dienst) => dienst.tag >= heute);
  const vorher = einsaetze.filter((einsatz) => einsatz.beginn < ab);
  const leer = { ...plan, rufdienstTag: new Map<string, Tag>(), mitBereitschaft: false };
  if (dienste.length === 0 && vorher.length === 0) return leer;
  const alsRufdienst = ({ beginn, ende, reaktionMinuten }: PlanRufdienst) => ({
    beginn,
    ende,
    ...(reaktionMinuten === null ? {} : { reaktionMinuten }),
  });
  // the call-outs before today join the days worked, as the same times worked (`ist`) would, and
  // the planned days stay grouped on their own as with `ist` (`planTage`; R-29, review S-505 round 6)
  const ist = bereitschaftstage(
    plan.tage.filter((tag) => tag.tag < heute),
    { einsaetze: vorher },
  );
  const geplant = bereitschaftstage(plan.tage.filter((tag) => tag.tag >= heute));
  if (!ist.ok || !geplant.ok) return leer;
  const ergebnis =
    dienste.length === 0
      ? { ok: true as const, wert: [...ist.wert, ...geplant.wert] }
      : bereitschaftstage([...ist.wert, ...geplant.wert], {
          rufdienste: dienste.map(alsRufdienst),
        });
  if (!ergebnis.ok) return leer;
  const tage: PruefTag[] = ergebnis.wert;
  const tagVon = new Map(
    [...plan.tagVon].map(([id, tag]) => {
      const beginn = schichtBeginn.get(id);
      return [id, (beginn === undefined ? null : arbeitstagMit(tage, beginn)) ?? tag] as const;
    }),
  );
  const rufdienstTag = new Map<string, Tag>();
  for (const dienst of dienste.filter((d) => zaehltVoll(alsRufdienst(d)))) {
    const tag = arbeitstagMit(tage, dienst.beginn);
    if (tag !== null) rufdienstTag.set(dienst.rufdienstId, tag);
  }
  return { tage, tagVon, rufdienstTag, mitBereitschaft: true };
};
