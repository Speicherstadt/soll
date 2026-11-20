import type { Abgefragt } from "../abfragen/abfrage.ts";
import { daten } from "../abfragen/abfrage.ts";
import type { Auslastung, TeamAntwort } from "./typen.ts";

/** What the team part of the page shows for an answer (S-604) */
export type TeamZustand =
  | { art: "werte"; werte: Auslastung }
  | { art: "zu_klein"; mindestens: number }
  | { art: "monat_laeuft" }
  | { art: "fehler" };

/**
 * The team view of an answer: its numbers, too few people for numbers, a month that has not ended,
 * or an error; the data last loaded stays shown through a failed load again
 */
export const teamZustand = (antwort: Abgefragt<TeamAntwort>): TeamZustand => {
  if (!antwort.ok && antwort.fehler === "monat_laeuft") return { art: "monat_laeuft" };
  const team = daten(antwort)?.team;
  if (team === undefined) return { art: "fehler" };
  return team.art === "team"
    ? { art: "werte", werte: team }
    : { art: "zu_klein", mindestens: team.mindestens };
};
