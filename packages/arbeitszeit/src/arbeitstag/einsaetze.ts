import { LAENGSTE_SCHICHT, NEUE_SCHICHT_AB, schichtgruppen } from "./schichten.ts";
import { durchlaufe, type Lauf, type Rohstueck, type Stempelung } from "./stempelungen.ts";

/*
 * Call-outs from a Rufbereitschaft as stamps (R-12, R-29; reviews of S-505). A call-out is read as
 * the same times stamped: Kommen at its beginning and Gehen at its end, a running one as a Kommen
 * still open. So the working days, shifts, breaks, the Ist, the findings, the lock and closing
 * read call-outs with the very functions that read stamps (S-201), and a call-out gets what the
 * same times stamped would get, by construction. Where stamped work covers part of a call-out it
 * counts once: the stamps inside the call-out are left out, and its beginning and end are stamped
 * only where the stamped work would not already be running there.
 */

/** A call-out from the call to the end of work; `ende` null while it runs */
export type Einsatzspanne = { beginn: number; ende: number | null };

type Zustand = "aus" | "arbeit" | "pause";

/** What the stamps alone say at an instant: just before it ("vor") or from it on ("ab") */
type Seite = "vor" | "ab";

/** A stretch of stamped work with how far it reaches: its end, or for an open one 24 h of its shift */
type Lage = { beginn: number; bis: number; pauseBis: number | null };

/**
 * How far each stamped stretch reaches, and the break after it: up to the next stretch that ends
 * it, or for a break left running up to the 9 h after which it is time off (`stempelungen`)
 */
const lagen = (lauf: Lauf): Lage[] => {
  const schichtBeginn = new Map<number, number>();
  for (const gruppe of schichtgruppen(lauf.stuecke)) {
    const beginn = lauf.stuecke[gruppe[0] as number]?.beginn as number;
    for (const index of gruppe) schichtBeginn.set(index, beginn);
  }
  const offenePausen = new Set(lauf.offenePausen);
  const letztes = lauf.stuecke.length - 1;
  return lauf.stuecke.map((stueck: Rohstueck, index): Lage => {
    const grenze = (schichtBeginn.get(index) as number) + LAENGSTE_SCHICHT;
    if (stueck.ende === null) return { beginn: stueck.beginn, bis: grenze, pauseBis: null };
    const naechstes = lauf.stuecke[index + 1];
    const laeuft = offenePausen.has(index) || (index === letztes && lauf.zustand === "pause");
    const pauseBis =
      stueck.endetMit !== "pause_beginn"
        ? null
        : naechstes?.nachPause === true
          ? naechstes.beginn
          : laeuft
            ? Math.min(stueck.ende + NEUE_SCHICHT_AB, grenze)
            : null;
    return { beginn: stueck.beginn, bis: stueck.ende, pauseBis };
  });
};

const innen = (seite: Seite, von: number, t: number, bis: number): boolean =>
  seite === "vor" ? von < t && t <= bis : von <= t && t < bis;

/** What the stamps alone say at `t`: work, a break, or nothing */
const zustandUm = (lagen: readonly Lage[], t: number, seite: Seite): Zustand => {
  if (lagen.some((lage) => innen(seite, lage.beginn, t, lage.bis))) return "arbeit";
  if (lagen.some((lage) => lage.pauseBis !== null && innen(seite, lage.bis, t, lage.pauseBis)))
    return "pause";
  return "aus";
};

/** Call-outs in time order, those that overlap one: Soll keeps them apart, a caller may not */
const vereinigt = (einsaetze: readonly Einsatzspanne[]): Einsatzspanne[] => {
  const ergebnis: Einsatzspanne[] = [];
  for (const einsatz of [...einsaetze].sort((a, b) => a.beginn - b.beginn)) {
    const letzter = ergebnis.at(-1);
    if (letzter !== undefined && (letzter.ende === null || einsatz.beginn < letzter.ende))
      ergebnis[ergebnis.length - 1] = {
        beginn: letzter.beginn,
        ende:
          letzter.ende === null || einsatz.ende === null
            ? null
            : Math.max(letzter.ende, einsatz.ende),
      };
    else ergebnis.push(einsatz);
  }
  return ergebnis;
};

/** The span a call-out covers: a running one as far as an open Kommen reaches (24 h, R-01) */
const reicht = ({ beginn, ende }: Einsatzspanne): number => ende ?? beginn + LAENGSTE_SCHICHT;

export type MitEinsatzstempeln = {
  /** the stamps to read: those outside the call-outs and the call-outs' own */
  stempel: Stempelung[];
  /** the stamps left out because a call-out covers them */
  verdeckt: Stempelung[];
  /** the stamped work alone, to tell the blocks that are only call-outs (R-12) */
  gestempelt: Lauf;
};

/**
 * The stamps with the call-outs as stamps: a call-out begins with Kommen unless stamped work runs
 * there already (after a break, Kommen ends it, as on a terminal), and ends with Gehen, or with
 * Pause-Beginn into a stamped break, unless stamped work goes on; a running one has no end
 */
export const mitEinsatzstempeln = (
  stempelungen: readonly Stempelung[],
  einsaetze: readonly Einsatzspanne[],
): MitEinsatzstempeln => {
  const gestempelt = durchlaufe(stempelungen);
  if (einsaetze.length === 0) return { stempel: [...stempelungen], verdeckt: [], gestempelt };
  const lage = lagen(gestempelt);
  const spannen = vereinigt(einsaetze);
  const verdeckt = (stempel: Stempelung) =>
    spannen.some(
      (einsatz) => einsatz.beginn <= stempel.zeitpunkt && stempel.zeitpunkt <= reicht(einsatz),
    );
  const eigene = spannen.flatMap((einsatz): Stempelung[] => {
    const davor = zustandUm(lage, einsatz.beginn, "vor");
    const anfang: Stempelung[] =
      davor === "arbeit" ? [] : [{ art: "kommen", zeitpunkt: einsatz.beginn }];
    if (einsatz.ende === null) return anfang;
    const danach = zustandUm(lage, einsatz.ende, "ab");
    const schluss: Stempelung[] =
      danach === "arbeit"
        ? []
        : [{ art: danach === "pause" ? "pause_beginn" : "gehen", zeitpunkt: einsatz.ende }];
    return [...anfang, ...schluss];
  });
  return {
    stempel: [...stempelungen.filter((stempel) => !verdeckt(stempel)), ...eigene],
    verdeckt: stempelungen.filter(verdeckt),
    gestempelt,
  };
};

/** Whether a call-out names instants and, once ended, ends after it began */
export const einsatzGueltig =
  (zeitpunktGueltig: (ms: number) => boolean) =>
  ({ beginn, ende }: Einsatzspanne): boolean =>
    zeitpunktGueltig(beginn) && (ende === null || (zeitpunktGueltig(ende) && ende > beginn));
