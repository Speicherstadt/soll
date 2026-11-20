import type { Stueck } from "../arbeitstag/schichten.ts";
import {
  beginntSchicht,
  LAENGSTE_SCHICHT,
  type Pause,
  type Schicht,
  schichtAus,
} from "../arbeitstag/schichten.ts";
import type { Rohstueck } from "../arbeitstag/stempelungen.ts";
import type { Tag } from "../kalender/tag.ts";
import type { PruefSchicht } from "../pruefung/typen.ts";
import { alsStueck, minutenVon, ohne, ueberschneiden, vereinigt } from "./spannen.ts";
import type { BereitschaftsSchicht, BereitschaftsTag, Spanne } from "./typen.ts";

/*
 * Working days rebuilt from their stretches of work with Bereitschaft and call-outs added. The shifts
 * are cut as S-201 cuts stamped ones (Grundbegriff „Schicht“: from 9 hours off a new shift, never
 * 24 hours past its start; a break under 15 minutes is working time), so a call-out or a duty that
 * follows a shift within 9 hours belongs to its working day, as stamped work would. A call-out
 * never joins two pieces of other work, though: after it a new rest begins (R-12), so the next shift
 * is a working day of its own unless it follows other work within 9 hours, or the call-out within
 * less than 15 minutes (then it is one stretch of work).
 */

/** A shift as it comes in: of S-201, planned, or already of S-206 */
type Eingangsschicht = PruefSchicht & { bereitschaft?: readonly Stueck[] };
type Eingangstag = { tag: Tag; schichten: readonly Eingangsschicht[] };

/** What the days hold: work, Bereitschaft within it, call-outs, open shifts and how breaks were taken */
export type Bestand = {
  arbeit: Spanne[];
  bereitschaft: Spanne[];
  einsaetze: Spanne[];
  offen: BereitschaftsSchicht[];
  pausenArten: ReadonlyMap<string, Pause["art"]>;
};

const schluessel = ({ beginn, ende }: Spanne): string => `${beginn} ${ende}`;

/** The stretches of a closed shift: its blocks without the short interruptions inside them */
const strecken = (schicht: PruefSchicht): Spanne[] =>
  ohne(
    schicht.bloecke,
    schicht.pausen.filter((pause) => !pause.ruhepause),
  );

const imEinsatz = (schicht: PruefSchicht, strecke: Spanne): boolean =>
  (schicht.einsaetze ?? []).some(
    (einsatz) => einsatz.beginn <= strecke.beginn && strecke.ende <= einsatz.ende,
  );

/**
 * An open shift stays as it is: its end is not known (R-01), so nothing is joined to it until its
 * Gehen is stamped
 */
const offeneSchicht = (schicht: Eingangsschicht): BereitschaftsSchicht => ({
  tag: schicht.tag,
  beginn: schicht.beginn,
  ende: schicht.ende,
  pausen: schicht.pausen,
  bloecke: schicht.bloecke,
  arbeitsMinuten: schicht.arbeitsMinuten,
  bereitschaft: schicht.bereitschaft ?? [],
  einsaetze: schicht.einsaetze ?? [],
});

export const bestandAus = (tage: readonly Eingangstag[]): Bestand => {
  const schichten = tage.flatMap((tag) => tag.schichten);
  const geschlossen = schichten.filter((schicht) => schicht.ende !== null);
  const teile = geschlossen.flatMap((schicht) =>
    strecken(schicht).map((strecke) => ({ strecke, einsatz: imEinsatz(schicht, strecke) })),
  );
  return {
    arbeit: teile.filter((teil) => !teil.einsatz).map((teil) => teil.strecke),
    bereitschaft: geschlossen.flatMap((schicht) => [...(schicht.bereitschaft ?? [])]),
    einsaetze: teile.filter((teil) => teil.einsatz).map((teil) => teil.strecke),
    offen: schichten.filter((schicht) => schicht.ende === null).map(offeneSchicht),
    pausenArten: new Map(
      schichten.flatMap((schicht) => schicht.pausen.map((p) => [schluessel(p), p.art] as const)),
    ),
  };
};

/**
 * A rebuilt shift with its marks: the Bereitschaft inside it, and the blocks that hold no other work
 * (call-outs); a break keeps the way it was taken (stamped or a gap)
 */
const markiert = (
  schicht: Schicht,
  werk: readonly Spanne[],
  bereitschaft: readonly Spanne[],
  pausenArten: ReadonlyMap<string, Pause["art"]>,
): BereitschaftsSchicht => {
  const ende = schicht.ende as number;
  return {
    tag: schicht.tag,
    beginn: schicht.beginn,
    ende,
    pausen: schicht.pausen.map((pause) => ({
      ...pause,
      art: pausenArten.get(schluessel(pause)) ?? pause.art,
    })),
    bloecke: schicht.bloecke,
    arbeitsMinuten: schicht.arbeitsMinuten,
    bereitschaft: bereitschaft
      .filter((teil) => teil.beginn >= schicht.beginn && teil.ende <= ende)
      .map(alsStueck),
    einsaetze: schicht.bloecke.filter((block) => !werk.some((teil) => ueberschneiden(teil, block))),
  };
};

/** § 4 Satz 2 ArbZG: an interruption under 15 minutes is working time, so the work goes on */
const KLEINSTE_RUHEPAUSE = 15 * 60_000;

type Teil = Rohstueck & { einsatz: boolean };

/**
 * Whether a stretch begins a new shift. A call-out follows the rule of S-201 (`beginntSchicht`);
 * other work after call-outs measures its 9 hours from the last other work, unless it goes on from
 * the call-out within 15 minutes.
 */
const neueSchicht = (
  erstes: Teil,
  vorher: Teil,
  letzteArbeit: Teil | null,
  teil: Teil,
): boolean => {
  if (teil.einsatz || !vorher.einsatz) return beginntSchicht(erstes.beginn, vorher, teil.beginn);
  if (teil.beginn - erstes.beginn >= LAENGSTE_SCHICHT) return true;
  if (teil.beginn - (vorher.ende as number) < KLEINSTE_RUHEPAUSE) return false;
  return letzteArbeit === null || beginntSchicht(erstes.beginn, letzteArbeit, teil.beginn);
};

/** The stretches of each shift, as indexes, in time order */
const schichtgruppen = (teile: readonly Teil[]): number[][] => {
  const gruppen: number[][] = [];
  let letzteArbeit: Teil | null = null;
  teile.forEach((teil, index) => {
    const gruppe = gruppen.at(-1);
    const erstes = gruppe === undefined ? undefined : teile[gruppe[0] as number];
    const vorher = teile[index - 1];
    if (gruppe === undefined || erstes === undefined || vorher === undefined) gruppen.push([index]);
    else if (neueSchicht(erstes, vorher, letzteArbeit, teil)) gruppen.push([index]);
    else gruppe.push(index);
    if (!teil.einsatz) letzteArbeit = teil;
  });
  return gruppen;
};

/** The closed shifts of the stretches, cut as S-201 cuts stamped work */
const schichtenAus = (bestand: Bestand): BereitschaftsSchicht[] => {
  const bereitschaft = vereinigt(bestand.bereitschaft);
  const werk = vereinigt([...bestand.arbeit, ...bereitschaft]);
  const einsaetze = ohne(bestand.einsaetze, werk);
  const teil =
    (einsatz: boolean) =>
    ({ beginn, ende }: Spanne): Teil => ({
      beginn,
      ende,
      endetMit: "gehen",
      nachPause: false,
      einsatz,
    });
  const roh = [...werk.map(teil(false)), ...einsaetze.map(teil(true))].sort(
    (a, b) => a.beginn - b.beginn,
  );
  const gruppen = schichtgruppen(roh);
  return gruppen.map((gruppe, index) => {
    const naechste = roh[gruppen[index + 1]?.[0] ?? -1]?.beginn ?? null;
    const schicht = schichtAus(
      gruppe.map((stueck) => roh[stueck] as Teil),
      false,
      naechste,
    );
    return markiert(schicht, werk, bereitschaft, bestand.pausenArten);
  });
};

const tagAus = (tag: Tag, schichten: BereitschaftsSchicht[]): BereitschaftsTag => {
  const zu = schichten.filter((schicht) => schicht.ende !== null);
  return {
    tag,
    schichten,
    arbeitsMinuten: zu.reduce((summe, schicht) => summe + schicht.arbeitsMinuten, 0),
    bereitschaftsMinuten: minutenVon(zu.flatMap((schicht) => schicht.bereitschaft)),
    einsatzMinuten: minutenVon(zu.flatMap((schicht) => schicht.einsaetze)),
  };
};

/** The working days of a Bestand, in calendar order, each with its shifts in time order */
export const tageAus = (bestand: Bestand): BereitschaftsTag[] => {
  const proTag = new Map<Tag, BereitschaftsSchicht[]>();
  for (const schicht of [...schichtenAus(bestand), ...bestand.offen]) {
    const liste = proTag.get(schicht.tag) ?? [];
    liste.push(schicht);
    proTag.set(schicht.tag, liste);
  }
  return [...proTag.keys()].sort().map((tag) =>
    tagAus(
      tag,
      (proTag.get(tag) ?? []).sort((a, b) => a.beginn - b.beginn),
    ),
  );
};
