import type { ImportZeit, LeseFehler } from "../modell.ts";
import { type Spanne, spanneAlsZeit, zusammenfassen } from "../spanne.ts";
import { type BerlinerUhr, berlinerUhr } from "../uhr.ts";
import type { Anwesenheit } from "./bestand.ts";
import { aufMinute, zeitpunktIn } from "./werte.ts";

/*
 * Personio's attendance periods as spans of work (BAULISTE.md S-704). API v2 keeps a day as periods
 * of the types WORK and BREAK (`/v2/attendance-periods`; n8n-nodes-personio-hr,
 * AttendancePeriodDescription.ts). Work is rounded outwards to the minute and a break inwards, the
 * breaks are taken out of the work, and the pieces of a person that touch or overlap become one
 * block with Kommen and Gehen; the gaps between blocks are the breaks as recorded (as Clockodo's
 * entries in S-703 and Kimai's timesheets in S-705). The time never shrinks by rounding (CLAUDE.md).
 */

const FELDER = { beginn: "start.date_time", ende: "end.date_time" };

/** Approved, or Personio runs no approval for it */
const BESTAETIGT = new Set([null, "CONFIRMED"]);
/** Refused periods never were */
const ABGELEHNT = "REJECTED";

type Stueck = Spanne & { person: string };

/** A period as instants on whole minutes, work outwards and a break inwards, or why it has none */
const alsStueck = (z: Anwesenheit, uhr: BerlinerUhr): Stueck | LeseFehler | null => {
  const { zeile } = z;
  if (z.status === ABGELEHNT) return null;
  if (!BESTAETIGT.has(z.status))
    return { zeile, grund: "nicht_genehmigt", feld: "approval.status", wert: z.status ?? "" };
  if (z.ende === null) return { zeile, grund: "laeuft_noch", feld: "end.date_time" };
  const beginn = zeitpunktIn(uhr, aufMinute(z.beginn, z.arbeit ? "ab" : "auf"));
  if (typeof beginn === "string") return { zeile, grund: "zeit_ungueltig", feld: FELDER.beginn };
  const ende = zeitpunktIn(uhr, aufMinute(z.ende, z.arbeit ? "auf" : "ab"));
  if (typeof ende === "string") return { zeile, grund: "zeit_ungueltig", feld: FELDER.ende };
  if (ende > beginn) return { zeile, id: z.id, person: z.person, beginn, ende };
  // a break of less than a minute takes nothing away; work that ends before it begins is no time
  return z.arbeit ? { zeile, grund: "zeit_ungueltig", feld: FELDER.ende } : null;
};

/** Breaks as disjoint spans in time order, so they are sorted by begin and by end alike */
const vereinigt = (pausen: readonly Stueck[]): Stueck[] =>
  zusammenfassen(pausen, (a, b) => a.beginn - b.beginn);

/** The first of the disjoint breaks that ends after `zeitpunkt` */
const ersteNach = (pausen: readonly Stueck[], zeitpunkt: number): number => {
  let unten = 0;
  let oben = pausen.length;
  while (unten < oben) {
    const mitte = (unten + oben) >> 1;
    if ((pausen[mitte] as Stueck).ende <= zeitpunkt) unten = mitte + 1;
    else oben = mitte;
  }
  return unten;
};

/** A piece of work without the breaks in it; a second piece is "<id>-2" and so on */
const ohnePausen = (arbeit: Stueck, pausen: readonly Stueck[]): Stueck[] => {
  const stuecke: Stueck[] = [];
  let beginn = arbeit.beginn;
  for (let i = ersteNach(pausen, beginn); i < pausen.length; i++) {
    const pause = pausen[i] as Stueck;
    if (pause.beginn >= arbeit.ende) break;
    if (pause.beginn > beginn) stuecke.push({ ...arbeit, beginn, ende: pause.beginn });
    beginn = Math.max(beginn, pause.ende);
  }
  if (beginn < arbeit.ende) stuecke.push({ ...arbeit, beginn });
  return stuecke.map((s, i) => (i === 0 ? s : { ...s, id: `${arbeit.id}-${i + 1}` }));
};

/** Pieces in time order; of two that begin in the same minute the lower id first */
const zeitfolge = (a: Stueck, b: Stueck): number =>
  a.beginn - b.beginn || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

type Ergebnis = { zeiten: ImportZeit[]; fehler: LeseFehler[] };

/** The pieces of each person: work, and the breaks as disjoint spans in time order */
const jePerson = (perioden: readonly Anwesenheit[], uhr: BerlinerUhr, fehler: LeseFehler[]) => {
  const personen = new Map<string, { arbeit: Stueck[]; pausen: Stueck[] }>();
  for (const periode of perioden) {
    const stueck = alsStueck(periode, uhr);
    if (stueck === null) continue;
    if ("grund" in stueck) {
      fehler.push(stueck);
      continue;
    }
    const eintrag = personen.get(stueck.person) ?? { arbeit: [], pausen: [] };
    (periode.arbeit ? eintrag.arbeit : eintrag.pausen).push(stueck);
    personen.set(stueck.person, eintrag);
  }
  for (const eintrag of personen.values()) eintrag.pausen = vereinigt(eintrag.pausen);
  return personen;
};

/** The spans of work of all periods; `person` names a person by Personio's id */
export const zeitenAus = (
  perioden: readonly Anwesenheit[],
  person: (id: string) => string,
): Ergebnis => {
  const uhr = berlinerUhr();
  const ergebnis: Ergebnis = { zeiten: [], fehler: [] };
  for (const [id, { arbeit, pausen }] of jePerson(perioden, uhr, ergebnis.fehler)) {
    const stuecke = arbeit.flatMap((stueck) => ohnePausen(stueck, pausen));
    for (const block of zusammenfassen(stuecke, zeitfolge)) {
      const zeit = spanneAlsZeit(block, person(id), uhr, FELDER);
      if ("grund" in zeit) ergebnis.fehler.push(zeit);
      else ergebnis.zeiten.push(zeit);
    }
  }
  return { zeiten: ergebnis.zeiten.sort((a, b) => a.zeile - b.zeile), fehler: ergebnis.fehler };
};
