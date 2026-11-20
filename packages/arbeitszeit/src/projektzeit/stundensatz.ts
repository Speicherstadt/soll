/**
 * The hourly rate of a booking of project time (BAULISTE.md S-601, docs/projektzeit.md). A rate names
 * any of activity, order (project), customer and person; one that names an order names no customer,
 * since the order belongs to one. The most specific fitting rate wins, in the order of the rate scores
 * of Kimai (kimai/kimai b4ac77a, src/Entity/ActivityRate.php 5, ProjectRate.php 3, CustomerRate.php 1,
 * src/Timesheet/RateService.php: +1 for the user, the user's own rate as the fallback): activity
 * before order before customer, on each level the person's before everyone's, then the person's own,
 * then the business's default. Combined as bits, an activity of an order outranks the activity alone.
 */

export type Satz = {
  satzId: string;
  kundeId: string | null;
  projektId: string | null;
  taetigkeitId: string | null;
  nutzerId: string | null;
  /** The first day it holds, `YYYY-MM-DD` */
  gueltigAb: string;
  /** Whole cents per hour */
  centProStunde: number;
};

/** What is booked: the order and its customer (none for internal time), activity, person, day */
export type Buchung = {
  kundeId: string | null;
  projektId: string | null;
  taetigkeitId: string;
  nutzerId: string;
  tag: string;
};

export type SatzErgebnis =
  | { art: "satz"; satzId: string; centProStunde: number }
  | { art: "nicht_hinterlegt" };

const passt = (satz: Satz, buchung: Buchung): boolean =>
  satz.gueltigAb <= buchung.tag &&
  (satz.taetigkeitId === null || satz.taetigkeitId === buchung.taetigkeitId) &&
  (satz.projektId === null || satz.projektId === buchung.projektId) &&
  (satz.kundeId === null || satz.kundeId === buchung.kundeId) &&
  (satz.nutzerId === null || satz.nutzerId === buchung.nutzerId);

/** The rank of a rate: activity 8, order 4, customer 2, person 1 */
export const satzRang = (satz: Pick<Satz, "kundeId" | "projektId" | "taetigkeitId" | "nutzerId">) =>
  (satz.taetigkeitId === null ? 0 : 8) +
  (satz.projektId === null ? 0 : 4) +
  (satz.kundeId === null ? 0 : 2) +
  (satz.nutzerId === null ? 0 : 1);

/** Higher rank first; on the same rank (the same rate over time) the latest valid from */
const vorrang = (a: Satz, b: Satz): number =>
  satzRang(b) - satzRang(a) || (a.gueltigAb < b.gueltigAb ? 1 : a.gueltigAb > b.gueltigAb ? -1 : 0);

/** The rate in force for a booking on its day, or "nicht hinterlegt" (never a guess, CLAUDE.md) */
export const stundensatz = (saetze: readonly Satz[], buchung: Buchung): SatzErgebnis => {
  const bester = saetze.filter((satz) => passt(satz, buchung)).sort(vorrang)[0];
  return bester
    ? { art: "satz", satzId: bester.satzId, centProStunde: bester.centProStunde }
    : { art: "nicht_hinterlegt" };
};
