import { aufMinute, ortszeitLesen, zeitpunktIn } from "../personio/werte.ts";
import { type BerlinerUhr, berlinerUhr } from "../uhr.ts";
import type {
  AbwesenheitSatz,
  ArbeitSatz,
  PersonSatz,
  SchichtplanerAbzug,
  SchichtSatz,
  Zeitpunkt,
} from "./abzug.ts";
import { idText, namenNachId, objekte, type Roh, text, vollerName } from "./werte.ts";

/*
 * Planday's Open API answers as the records of a shift planner (BAULISTE.md S-706). Sources, as
 * openapi.planday.com and developer.planday.com are not reachable: github.com/borgels/
 * mcp-server-planday (src/planday/resources.ts, its schemas after Planday's OpenAPI documents
 * openapi.planday.com/{hr,scheduling,punchclock,absence}/swagger/v1.0/swagger.json: employees with
 * `firstName`, `lastName`; shifts with `employeeId`, `positionId`, `startDateTime`, `endDateTime`,
 * `status`, `manualBreaks`; punch clock records with `employeeId`, `startDateTime`,
 * `endDateTime`; absence requests with `employeeId`, `absencePeriod` `start`/`end`, `status`
 * Submitted, Declined, Approved, Cancelled, and `absenceType` Vacation, Absence, Flextime, Accrued)
 * and Planday's time clock guide as a search shows it (the breaks of a record under
 * `/punchclockshifts/{id}/breaks`). Planday writes local time without an offset (tests of
 * mcp-server-planday: "2026-11-19T08:00"), read in Europe/Berlin.
 */

/** What a fetch got from Planday, list by list; the breaks by the id of their punch clock record */
export type PlandayAntworten = {
  employees: readonly unknown[];
  positions: readonly unknown[];
  shifts: readonly unknown[];
  punchClock: readonly unknown[];
  breaks: Readonly<Record<string, readonly unknown[]>>;
  absenceRequests: readonly unknown[];
};

/** A local time as Planday writes it, with or without seconds, as an instant on a whole minute */
const ortszeit = (uhr: BerlinerUhr, wert: unknown, richtung: "ab" | "auf"): Zeitpunkt => {
  if (wert === null || wert === undefined) return null;
  const roh = text(wert);
  const ort = ortszeitLesen(/T\d\d:\d\d$/.test(roh) ? `${roh}:00` : roh);
  if (ort === null) return roh.slice(0, 40);
  const zeitpunkt = zeitpunktIn(uhr, aufMinute(ort, richtung));
  // a time the clocks skip or pass twice names no instant: the reader refuses it with its line
  return typeof zeitpunkt === "number" ? zeitpunkt : roh.slice(0, 40);
};

const personen = (employees: readonly Roh[]): PersonSatz[] =>
  employees.map((e) => ({
    kind: "person",
    id: idText(e.id),
    name: vollerName(e.firstName, e.lastName),
  }));

const MINUTE = 60_000;

/** The planned breaks of a shift in whole minutes, rounded down: the work never shrinks */
const geplantePause = (uhr: BerlinerUhr, s: Roh): number => {
  let ms = 0;
  for (const b of objekte(s.manualBreaks)) {
    const von = ortszeit(uhr, b.startDateTime, "auf");
    const bis = ortszeit(uhr, b.endDateTime, "ab");
    if (typeof von === "number" && typeof bis === "number" && bis > von) ms += bis - von;
  }
  return Math.min(Math.floor(ms / MINUTE), 1440);
};

/** Planned shifts; a draft Planday has not published is not the plan anybody saw */
const schichten = (uhr: BerlinerUhr, shifts: readonly Roh[], positions: readonly Roh[]) => {
  const rollen = namenNachId(positions, "id", "name");
  return shifts
    .filter((s) => s.status !== "Draft" && s.isDraft !== true)
    .map(
      (s): SchichtSatz => ({
        kind: "shift",
        id: idText(s.id),
        person: s.employeeId === null || s.employeeId === undefined ? null : idText(s.employeeId),
        begin: ortszeit(uhr, s.startDateTime, "ab"),
        end: ortszeit(uhr, s.endDateTime, "auf"),
        break: geplantePause(uhr, s),
        role: rollen.get(idText(s.positionId)) ?? "",
      }),
    );
};

type Luecke = { beginn: number; ende: number };

/** The breaks of a record, inward on whole minutes and in time order; null when one is unreadable */
const pausen = (uhr: BerlinerUhr, liste: readonly unknown[] | undefined): Luecke[] | null => {
  const ergebnis: Luecke[] = [];
  for (const b of objekte(liste ?? [])) {
    if (b.endDateTime === null || b.endDateTime === undefined) continue;
    const von = ortszeit(uhr, b.startDateTime, "auf");
    const bis = ortszeit(uhr, b.endDateTime, "ab");
    if (typeof von !== "number" || typeof bis !== "number") return null;
    if (bis > von) ergebnis.push({ beginn: von, ende: bis });
  }
  return ergebnis.sort((a, b) => a.beginn - b.beginn);
};

/** A punch clock record's pieces of work around its breaks; the first carries the record's id */
const stuecke = (uhr: BerlinerUhr, r: Roh, breaks: PlandayAntworten["breaks"]): ArbeitSatz[] => {
  const basis = { kind: "work" as const, id: idText(r.id), person: idText(r.employeeId) };
  const beginn = ortszeit(uhr, r.startDateTime, "ab");
  const ende = ortszeit(uhr, r.endDateTime, "auf");
  const luecken =
    typeof beginn === "number" && typeof ende === "number" && ende > beginn
      ? pausen(uhr, Object.hasOwn(breaks, basis.id) ? breaks[basis.id] : [])
      : null;
  if (luecken === null) return [{ ...basis, begin: beginn, end: ende }];
  const teile: ArbeitSatz[] = [];
  let von = beginn as number;
  for (const luecke of [...luecken, { beginn: ende as number, ende: ende as number }]) {
    if (luecke.beginn > von)
      teile.push({
        ...basis,
        id: teile.length === 0 ? basis.id : `${basis.id}/${teile.length + 1}`,
        begin: von,
        end: Math.min(luecke.beginn, ende as number),
      });
    von = Math.max(von, luecke.ende);
  }
  return teile;
};

/** A day and whether a time of day goes with it that whole days cannot name */
const tagUndRest = (wert: unknown, ende: boolean): { tag: string; teil: boolean } => {
  const roh = text(wert);
  const uhrzeit = roh.slice(11, 16);
  const ganz = uhrzeit === "" || uhrzeit === "00:00" || (ende && uhrzeit === "23:59");
  return { tag: roh.slice(0, 10), teil: !ganz };
};

const OFFEN = "Submitted";
const GENEHMIGT = "Approved";

/** Approved and submitted absence requests; a declined or cancelled one never was */
const abwesenheiten = (requests: readonly Roh[]): AbwesenheitSatz[] =>
  requests
    .filter((a) => a.status === GENEHMIGT || a.status === OFFEN)
    .map((a) => {
      const zeitraum = (objekte([a.absencePeriod])[0] ?? {}) as Roh;
      const von = tagUndRest(zeitraum.start, false);
      const bis = tagUndRest(zeitraum.end, true);
      return {
        kind: "absence",
        id: idText(a.id),
        person: idText(a.employeeId),
        type: text(a.absenceType),
        from: von.tag,
        to: bis.tag,
        first_half: false,
        last_half: false,
        approved: a.status === GENEHMIGT,
        part_day: von.teil || bis.teil,
      };
    });

/** The records of a fetch from Planday */
export const plandayAbzug = (
  antworten: PlandayAntworten,
  zeitraum: { von: string; bis: string },
): SchichtplanerAbzug => {
  const uhr = berlinerUhr();
  const breaks =
    typeof antworten.breaks === "object" && antworten.breaks !== null ? antworten.breaks : {};
  return {
    werkzeug: "planday",
    ...zeitraum,
    saetze: [
      ...personen(objekte(antworten.employees)),
      ...schichten(uhr, objekte(antworten.shifts), objekte(antworten.positions)),
      ...objekte(antworten.punchClock).flatMap((r) => stuecke(uhr, r, breaks)),
      ...abwesenheiten(objekte(antworten.absenceRequests)),
    ],
  };
};
