import type {
  AbwesenheitSatz,
  ArbeitSatz,
  PersonSatz,
  SchichtplanerAbzug,
  SchichtSatz,
} from "./abzug.ts";
import { idText, namenNachId, objekte, type Roh, text, zeitpunkt } from "./werte.ts";

/*
 * Crewmeister's API v3 answers as the records of a shift planner (BAULISTE.md S-706). Sources, as
 * crewmeister.com is not reachable: github.com/mztechnik/hacs-crewmeister (api/models.py: stamps
 * with `stampType` START_WORK, START_BREAK, CLOCK_OUT, `stampStatus` OPEN, CLOSED, INVALID,
 * `chainStartStampId`, `timestamp`; absences with `from`, `to`, `fromDayPart`, `toDayPart`,
 * `absenceType`, `state`) and github.com/HelpCode-ai/anythingmcp (adapters/de/crewmeister.json:
 * members with `userId` and `name`, absence type settings with `absenceTypeId` and `name`, the
 * states DRAFT, REQUESTED, PRE_APPROVED, APPROVED, REJECTED, REVOKED, the day parts MORNING and
 * AFTERNOON, shifts with `userId`, `from`, `to`, `workplaceId`, `publishedShiftId`, workplaces with
 * `name`). The planned break of a shift is named by no source and is not read (docs/umzug.md).
 */

/** What a fetch got from Crewmeister, list by list, as the API answered */
export type CrewmeisterAntworten = {
  members: readonly unknown[];
  absenceTypes: readonly unknown[];
  absences: readonly unknown[];
  stamps: readonly unknown[];
  shifts: readonly unknown[];
  workplaces: readonly unknown[];
};

const personen = (members: readonly Roh[]): PersonSatz[] =>
  members.map((m) => ({ kind: "person", id: idText(m.userId), name: text(m.name) }));

/** The instant of a stamp for ordering: unknown ones last */
const wann = (s: Roh): number => {
  const z = zeitpunkt(s.timestamp);
  return typeof z === "number" ? z : Number.MAX_SAFE_INTEGER;
};

/**
 * The pieces of work of the stamps: a chain (`chainStartStampId`, its start naming itself or none)
 * in time order, each START_WORK until the stamp after it; none after it: the piece still runs.
 * An INVALID stamp does not count.
 */
const arbeit = (stamps: readonly Roh[]): ArbeitSatz[] => {
  const ketten = new Map<string, Roh[]>();
  for (const s of stamps) {
    if (s.stampStatus === "INVALID") continue;
    const kette = idText(s.chainStartStampId ?? s.id);
    ketten.set(kette, [...(ketten.get(kette) ?? []), s]);
  }
  return [...ketten.values()].flatMap((kette) => {
    const folge = [...kette].sort((a, b) => wann(a) - wann(b));
    return folge.flatMap((s, i) => {
      if (s.stampType !== "START_WORK") return [];
      const naechster = folge[i + 1];
      return [
        {
          kind: "work" as const,
          id: idText(s.id),
          person: idText(s.userId),
          begin: zeitpunkt(s.timestamp),
          end: naechster ? zeitpunkt(naechster.timestamp) : null,
        },
      ];
    });
  });
};

/** A person's id, or null for a shift nobody is planned on */
const wer = (wert: unknown): string | null =>
  wert === null || wert === undefined ? null : idText(wert);

/** Planned shifts; one with `publishedShiftId` is the draft of a published one, which comes itself */
const schichten = (shifts: readonly Roh[], workplaces: readonly Roh[]): SchichtSatz[] => {
  const orte = namenNachId(workplaces, "id", "name");
  return shifts
    .filter((s) => s.publishedShiftId === null || s.publishedShiftId === undefined)
    .map((s) => ({
      kind: "shift",
      id: idText(s.id),
      person: wer(s.userId),
      begin: zeitpunkt(s.from),
      end: zeitpunkt(s.to),
      break: 0,
      role: orte.get(idText(s.workplaceId)) ?? "",
    }));
};

const GENEHMIGT = "APPROVED";
const OFFEN = new Set(["DRAFT", "REQUESTED", "PRE_APPROVED"]);

/** A day as Crewmeister writes `from` and `to` (yyyy-MM-dd, perhaps with a time after it) */
const tag = (wert: unknown): string => text(wert).slice(0, 10);

/** Approved and open absences; a refused or revoked one never was */
const abwesenheiten = (absences: readonly Roh[], arten: readonly Roh[]): AbwesenheitSatz[] => {
  const namen = namenNachId(arten, "absenceTypeId", "name");
  return absences
    .filter((a) => a.state === GENEHMIGT || OFFEN.has(a.state as string))
    .map((a) => {
      const art = idText(a.absenceType);
      return {
        kind: "absence",
        id: idText(a.id),
        person: idText(a.userId),
        type: namen.get(art) || (art === "" ? "" : `#${art}`),
        from: tag(a.from),
        to: tag(a.to),
        first_half: a.fromDayPart === "AFTERNOON",
        last_half: a.toDayPart === "MORNING",
        approved: a.state === GENEHMIGT,
        part_day: false,
      };
    });
};

/** The records of a fetch from Crewmeister */
export const crewmeisterAbzug = (
  antworten: CrewmeisterAntworten,
  zeitraum: { von: string; bis: string },
): SchichtplanerAbzug => ({
  werkzeug: "crewmeister",
  ...zeitraum,
  saetze: [
    ...personen(objekte(antworten.members)),
    ...schichten(objekte(antworten.shifts), objekte(antworten.workplaces)),
    ...arbeit(objekte(antworten.stamps)),
    ...abwesenheiten(objekte(antworten.absences), objekte(antworten.absenceTypes)),
  ],
});
