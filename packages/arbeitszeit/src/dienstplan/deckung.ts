import { plusTage, type Tag, wochentag } from "../kalender/tag.ts";
import { zeitpunktInBerlin } from "../kalender/zeit.ts";
import type { Bedarf, PlanSchicht } from "./typen.ts";
import type { Zeitspanne } from "./zeiten.ts";

/** A need on one day: how many people it asks for, how many are planned, how many are missing */
export type Deckung = Zeitspanne & {
  bedarfId: string;
  tag: Tag;
  standortId: string;
  rolle: string;
  anzahl: number;
  /** the fewest people of the role planned at any moment of the need */
  geplant: number;
  /** shifts of the role that nobody is planned for yet and that touch the need */
  offen: number;
  fehlt: number;
};

/** 1 Monday to 7 Sunday (ISO 8601), as a need names its weekday */
const isoWochentag = (tag: Tag): number => ((wochentag(tag) + 6) % 7) + 1;

/**
 * The span of a need on a day. Unlike a shift it always exists: a need from 2:30 in the night the
 * clocks skip counts in real minutes from midnight (zeitpunktInBerlin)
 */
const fenster = (tag: Tag, bedarf: Bedarf): Zeitspanne => ({
  beginn: zeitpunktInBerlin(tag, bedarf.beginnMinute),
  ende: zeitpunktInBerlin(
    bedarf.endeMinute > bedarf.beginnMinute ? tag : plusTage(tag, 1),
    bedarf.endeMinute,
  ),
});

/** The fewest of the spans that cover any moment of the window */
const wenigsteZugleich = (spannen: readonly Zeitspanne[], ziel: Zeitspanne): number => {
  const grenzen = [
    ...new Set([ziel.beginn, ziel.ende, ...spannen.flatMap((s) => [s.beginn, s.ende])]),
  ]
    .filter((grenze) => grenze >= ziel.beginn && grenze <= ziel.ende)
    .sort((a, b) => a - b);
  const stuecke = grenzen.slice(1).map((ende, index) => ({ beginn: grenzen[index] ?? 0, ende }));
  if (stuecke.length === 0) return 0;
  return Math.min(
    ...stuecke.map(
      (stueck) => spannen.filter((s) => s.beginn <= stueck.beginn && s.ende >= stueck.ende).length,
    ),
  );
};

const deckungAm = (tag: Tag, bedarf: Bedarf, schichten: readonly PlanSchicht[]): Deckung => {
  const spanne = fenster(tag, bedarf);
  const passend = schichten.filter(
    (schicht) =>
      schicht.standortId === bedarf.standortId &&
      schicht.rolle === bedarf.rolle &&
      schicht.beginn < spanne.ende &&
      schicht.ende > spanne.beginn,
  );
  const geplant = wenigsteZugleich(
    passend.filter((schicht) => schicht.nutzerId !== null),
    spanne,
  );
  return {
    bedarfId: bedarf.bedarfId,
    tag,
    standortId: bedarf.standortId,
    rolle: bedarf.rolle,
    ...spanne,
    anzahl: bedarf.anzahl,
    geplant,
    offen: passend.filter((schicht) => schicht.nutzerId === null).length,
    fehlt: Math.max(0, bedarf.anzahl - geplant),
  };
};

/**
 * Whether the plan of a week covers the need per role and site (S-501): for every day and need, the
 * fewest people of that role planned at the site at any moment of the need, so two shifts after one
 * another cover a long need once and a gap between them leaves it uncovered. A shift of the day
 * before reaching into the need counts too, an open shift does not, but is shown. Days in the order
 * given, then by beginning and role.
 */
export const bedarfsDeckung = (
  tage: readonly Tag[],
  bedarfe: readonly Bedarf[],
  schichten: readonly PlanSchicht[],
): Deckung[] =>
  tage.flatMap((tag) =>
    bedarfe
      .filter((bedarf) => bedarf.wochentag === isoWochentag(tag))
      .map((bedarf) => deckungAm(tag, bedarf, schichten))
      .sort((a, b) => a.beginn - b.beginn || a.rolle.localeCompare(b.rolle)),
  );
