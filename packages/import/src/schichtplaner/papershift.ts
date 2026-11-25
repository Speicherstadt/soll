import { tagInBerlin } from "@soll/arbeitszeit";
import type { AbwesenheitSatz, ArbeitSatz, PersonSatz, SchichtplanerAbzug } from "./abzug.ts";
import { idText, namenNachId, objekte, type Roh, text, vollerName, zeitpunkt } from "./werte.ts";

/*
 * Papershift's public API v1 answers as the records of a shift planner (BAULISTE.md S-706).
 * Sources, as developers.papershift.com is not reachable: Papershift's own
 * github.com/Papershift/hosted_pages_template (`/working_sessions` with `starts_at`, `ends_at`),
 * github.com/maluramichael/papershift-cli (`user_id`, `breaks` with `starts_at` and `ends_at`),
 * github.com/bestit/bamboohr-connector and the gist younishd/e69f87e8 (absences with `user_id`,
 * `absence_type_id`, `starts_at`, `ends_at` until "T24:00", `full_day`), and the excerpts of the
 * documentation a web search shows (`confirmed_at`, `break_duration` in seconds). Papershift's
 * shifts are places of a working area with a number of employees; who is planned on them no source
 * names, so they are not read (docs/plan.md, "Schichten aus Papershift").
 */

/** What a fetch got from Papershift, list by list */
export type PapershiftAntworten = {
  users: readonly unknown[];
  absenceTypes: readonly unknown[];
  absences: readonly unknown[];
  workingSessions: readonly unknown[];
};

const MINUTE = 60_000;

/** A user's name: `name`, or first and last name as Papershift's forms have them */
const name = (u: Roh): string =>
  text(u.name) || vollerName(u.firstname, u.lastname) || vollerName(u.first_name, u.last_name);

const personen = (users: readonly Roh[]): PersonSatz[] =>
  users.map((u) => ({ kind: "person", id: idText(u.id), name: name(u) }));

type Luecke = { beginn: number; ende: number };

/** The breaks of a session as stamped, inside it and in time order; null when one is unreadable */
const pausen = (s: Roh, beginn: number, ende: number): Luecke[] | null => {
  const liste: Luecke[] = [];
  for (const b of objekte(s.breaks)) {
    const von = zeitpunkt(b.starts_at);
    const bis = zeitpunkt(b.ends_at);
    if (typeof von !== "number" || typeof bis !== "number" || bis < von) return null;
    if (bis > beginn && von < ende)
      liste.push({ beginn: Math.max(von, beginn), ende: Math.min(bis, ende) });
  }
  return liste.sort((a, b) => a.beginn - b.beginn);
};

/**
 * A break of which only the length is known (`break_duration`, seconds) in the middle of the
 * session, its length rounded down to the minute and its place on whole minutes: the work never
 * shrinks (as Kimai's break, S-705) and the break the person took stays whole
 */
const mittlerePause = (s: Roh, beginn: number, ende: number): Luecke[] => {
  const sekunden = s.break_duration;
  if (typeof sekunden !== "number" || !Number.isSafeInteger(sekunden) || sekunden <= 0) return [];
  const pause = Math.floor(sekunden / 60) * MINUTE;
  // on whole minutes from the first one after the begin, so rounding the work outwards keeps the
  // whole break (review S-706: from 08:00:30 a break off the minute shrank to 29 minutes, § 4 ArbZG)
  const ab = Math.ceil(beginn / MINUTE) * MINUTE;
  if (pause === 0 || ab + pause >= ende) return [];
  const start = ab + Math.floor((ende - ab - pause) / 2 / MINUTE) * MINUTE;
  return [{ beginn: start, ende: start + pause }];
};

/** A session's pieces of work around its breaks; the first carries the session's id */
const stuecke = (s: Roh): ArbeitSatz[] => {
  const basis = { kind: "work" as const, id: idText(s.id), person: idText(s.user_id) };
  const beginn = zeitpunkt(s.starts_at);
  const ende = zeitpunkt(s.ends_at);
  if (typeof beginn !== "number" || typeof ende !== "number" || ende <= beginn)
    return [{ ...basis, begin: beginn, end: ende }];
  const luecken = pausen(s, beginn, ende);
  const liste =
    luecken === null ? [] : luecken.length > 0 ? luecken : mittlerePause(s, beginn, ende);
  const teile: ArbeitSatz[] = [];
  let von = beginn;
  for (const luecke of [...liste, { beginn: ende, ende }]) {
    if (luecke.beginn > von)
      teile.push({
        ...basis,
        id: teile.length === 0 ? basis.id : `${basis.id}/${teile.length + 1}`,
        begin: von,
        end: luecke.beginn,
      });
    von = Math.max(von, luecke.ende);
  }
  return teile;
};

/**
 * The last day of an absence: an end at midnight ("…T24:00" or "…T00:00" of the next day, as
 * Papershift's forms write a whole day) belongs to the day before
 */
const letzterTag = (ende: number): string => tagInBerlin(ende - 1);

const abwesenheiten = (absences: readonly Roh[], arten: readonly Roh[]): AbwesenheitSatz[] => {
  const namen = namenNachId(arten, "id", "name");
  return absences.map((a) => {
    const art = idText(a.absence_type_id);
    const beginn = zeitpunkt(a.starts_at);
    // "T24:00" is no time of day ISO 8601 still allows; it is the midnight after
    const endeText = text(a.ends_at).replace(/T24:00(:00)?/, "T23:59:59");
    const ende = zeitpunkt(endeText);
    return {
      kind: "absence",
      id: idText(a.id),
      person: idText(a.user_id),
      type: namen.get(art) || (art === "" ? "" : `#${art}`),
      from: typeof beginn === "number" ? tagInBerlin(beginn) : "",
      to: typeof ende === "number" ? letzterTag(ende) : "",
      first_half: false,
      last_half: false,
      approved: a.confirmed_at !== null && a.confirmed_at !== undefined,
      part_day: a.full_day !== true,
    };
  });
};

/** The records of a fetch from Papershift */
export const papershiftAbzug = (
  antworten: PapershiftAntworten,
  zeitraum: { von: string; bis: string },
): SchichtplanerAbzug => ({
  werkzeug: "papershift",
  ...zeitraum,
  saetze: [
    ...personen(objekte(antworten.users)),
    ...objekte(antworten.workingSessions).flatMap(stuecke),
    ...abwesenheiten(objekte(antworten.absences), objekte(antworten.absenceTypes)),
  ],
});
