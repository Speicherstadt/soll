import {
  type Pause,
  type Schicht,
  type Stueck,
  schichtAus,
  schichtgruppen,
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
 * follows a shift within 9 hours belongs to its working day, and work that follows a call-out
 * within 9 hours belongs to the call-out's, exactly as the same times stamped would (R-12, R-29;
 * reviews of S-505). Only the rest reads call-outs apart (`ruhezeit`, R-12).
 */

/** A shift as it comes in: of S-201, planned, or already of S-206 */
type Eingangsschicht = PruefSchicht & {
  bereitschaft?: readonly Stueck[];
  bereitschaftsdienst?: readonly Stueck[];
};
type Eingangstag = { tag: Tag; schichten: readonly Eingangsschicht[] };

/**
 * What the days hold: work, Bereitschaft within it (and the part of it that is Bereitschaftsdienst
 * or Arbeitsbereitschaft; Bereitschaft without that mark is none, the careful reading), call-outs,
 * open shifts and how breaks were taken
 */
export type Bestand = {
  arbeit: Spanne[];
  bereitschaft: Spanne[];
  bereitschaftsdienst: Spanne[];
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
  bereitschaftsdienst: schicht.bereitschaftsdienst ?? [],
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
    bereitschaftsdienst: geschlossen.flatMap((schicht) => [...(schicht.bereitschaftsdienst ?? [])]),
    einsaetze: teile.filter((teil) => teil.einsatz).map((teil) => teil.strecke),
    offen: schichten.filter((schicht) => schicht.ende === null).map(offeneSchicht),
    pausenArten: new Map(
      schichten.flatMap((schicht) => schicht.pausen.map((p) => [schluessel(p), p.art] as const)),
    ),
  };
};

/**
 * A rebuilt shift with its marks: the Bereitschaft inside it, the Bereitschaftsdienst among it, and
 * the blocks that hold no other work (call-outs); a break keeps the way it was taken (stamped or a
 * gap)
 */
const markiert = (
  schicht: Schicht,
  werk: readonly Spanne[],
  { bereitschaft, bereitschaftsdienst }: Pick<Bestand, "bereitschaft" | "bereitschaftsdienst">,
  pausenArten: ReadonlyMap<string, Pause["art"]>,
): BereitschaftsSchicht => {
  const ende = schicht.ende as number;
  const darin = (teile: readonly Spanne[]) =>
    teile.filter((teil) => teil.beginn >= schicht.beginn && teil.ende <= ende).map(alsStueck);
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
    bereitschaft: darin(bereitschaft),
    bereitschaftsdienst: darin(bereitschaftsdienst),
    einsaetze: schicht.bloecke.filter((block) => !werk.some((teil) => ueberschneiden(teil, block))),
  };
};

/** The closed shifts of the stretches, cut as S-201 cuts stamped work */
const schichtenAus = (bestand: Bestand): BereitschaftsSchicht[] => {
  const bereitschaft = vereinigt(bestand.bereitschaft);
  const bereitschaftsdienst = vereinigt(bestand.bereitschaftsdienst);
  const werk = vereinigt([...bestand.arbeit, ...bereitschaft]);
  const einsaetze = ohne(bestand.einsaetze, werk);
  const roh = [...werk, ...einsaetze]
    .map(({ beginn, ende }): Rohstueck => ({ beginn, ende, endetMit: "gehen", nachPause: false }))
    .sort((a, b) => a.beginn - b.beginn);
  const gruppen = schichtgruppen(roh);
  return gruppen.map((gruppe, index) => {
    const naechste = roh[gruppen[index + 1]?.[0] ?? -1]?.beginn ?? null;
    const schicht = schichtAus(
      gruppe.map((stueck) => roh[stueck] as Rohstueck),
      false,
      naechste,
    );
    return markiert(schicht, werk, { bereitschaft, bereitschaftsdienst }, bestand.pausenArten);
  });
};

const tagAus = (tag: Tag, schichten: BereitschaftsSchicht[]): BereitschaftsTag => {
  const zu = schichten.filter((schicht) => schicht.ende !== null);
  return {
    tag,
    schichten,
    arbeitsMinuten: zu.reduce((summe, schicht) => summe + schicht.arbeitsMinuten, 0),
    bereitschaftsMinuten: minutenVon(zu.flatMap((schicht) => schicht.bereitschaft)),
    bereitschaftsdienstMinuten: minutenVon(zu.flatMap((schicht) => schicht.bereitschaftsdienst)),
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
