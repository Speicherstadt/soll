import { tagInBerlin } from "@soll/arbeitszeit";
import type { ImportSchicht, Zuordnung } from "@soll/import";
import type { Abgelehnt, Anzahl, NeueSchicht, PlanGrund, Stand } from "./plan-typen.ts";

/*
 * The planned shifts of a shift planner as shifts of Soll's plan (BAULISTE.md S-706): only with the
 * module Dienstplan, at the site the owner chose for them, as drafts. A shift is the plan, not a
 * record of working time, so a closed month does not refuse it (S-306 locks records); it may not
 * overlap another shift of the same person, and a shift an earlier import took over is there
 * already, or named when the old tool has changed it since.
 */

type Spanne = { beginn: number; ende: number };

const ueberschneiden = (a: Spanne, b: Spanne) => a.beginn < b.ende && b.beginn < a.ende;

/** Whether a shift an earlier import wrote still says what the record says */
const gleich = (
  satz: ImportSchicht,
  nutzerId: string | null,
  da: {
    nutzerId: string | null;
    beginn: number;
    ende: number;
    pauseMinuten: number;
    rolle: string;
  },
) =>
  da.beginn === satz.beginn &&
  da.ende === satz.ende &&
  da.pauseMinuten === satz.pauseMinuten &&
  da.rolle === satz.rolle &&
  da.nutzerId === nutzerId;

type Ergebnis =
  | { art: "neu"; schicht: NeueSchicht }
  | { art: "vorhanden" | "ausgelassen" }
  | PlanGrund;

/** The person of a shift: null for an open one, undefined when it is not taken over */
const personVon = (
  satz: ImportSchicht,
  zuordnung: Zuordnung,
  stand: Stand,
): string | null | undefined | "person_unbekannt" => {
  if (satz.person === null) return null;
  const nutzerId = zuordnung.personen[satz.person] ?? null;
  if (nutzerId === null) return undefined;
  return stand.mitglieder.has(nutzerId) ? nutzerId : "person_unbekannt";
};

const schichtPlanen = (
  satz: ImportSchicht,
  kontext: { zuordnung: Zuordnung; stand: Stand; genommen: Map<string, Spanne[]> },
): Ergebnis => {
  const { zuordnung, stand, genommen } = kontext;
  if (!stand.module.dienstplan) return "modul_aus";
  const standortId = zuordnung.standort ?? null;
  const nutzerId = personVon(satz, zuordnung, stand);
  if (standortId === null || nutzerId === undefined) return { art: "ausgelassen" };
  if (nutzerId === "person_unbekannt") return nutzerId;
  const da = stand.vorhanden.schichten.get(satz.externalId);
  if (da !== undefined) {
    if (gleich(satz, nutzerId, da)) return { art: "vorhanden" };
    return da.nutzerId !== nutzerId ? "zuordnung_abweichend" : "geaendert_im_alten_tool";
  }
  if (nutzerId !== null) {
    const bisher = genommen.get(nutzerId) ?? [];
    if ([...stand.schichtenVon(nutzerId), ...bisher].some((s) => ueberschneiden(s, satz)))
      return "ueberschneidung";
    genommen.set(nutzerId, [...bisher, satz]);
  }
  return {
    art: "neu",
    schicht: {
      standortId,
      tag: tagInBerlin(satz.beginn),
      beginn: satz.beginn,
      ende: satz.ende,
      pauseMinuten: satz.pauseMinuten,
      rolle: satz.rolle,
      nutzerId,
      externId: satz.externalId,
    },
  };
};

/** The plan of the shifts: the new ones, the counts and the refused with their line */
export const schichtenPlanen = (
  saetze: readonly ImportSchicht[],
  zuordnung: Zuordnung,
  stand: Stand,
): { neu: NeueSchicht[]; zahlen: Anzahl; abgelehnt: Abgelehnt[] } => {
  const zahlen: Anzahl = { neu: 0, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 };
  const neu: NeueSchicht[] = [];
  const abgelehnt: Abgelehnt[] = [];
  const genommen = new Map<string, Spanne[]>();
  for (const satz of saetze) {
    const ergebnis = schichtPlanen(satz, { zuordnung, stand, genommen });
    if (typeof ergebnis === "string") {
      zahlen.abgelehnt += 1;
      abgelehnt.push({
        art: "schichten",
        zeile: satz.zeile,
        externalId: satz.externalId,
        grund: ergebnis,
      });
    } else {
      zahlen[ergebnis.art] += 1;
      if (ergebnis.art === "neu") neu.push(ergebnis.schicht);
    }
  }
  return { neu, zahlen, abgelehnt };
};
