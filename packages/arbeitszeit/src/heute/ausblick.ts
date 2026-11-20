import type { Arbeitstag } from "../arbeitstag/arbeitstag.ts";
import type { Schicht } from "../arbeitstag/schichten.ts";
import type { ArbzgGrenzen } from "../pruefung/grenzen.ts";

/**
 * The next finding ahead on the running day (BAULISTE.md S-304, DESIGN.md "Befund mit Norm"): the
 * break owed under § 4 ArbZG with the minutes still to take, 8 and 10 hours under § 3 ArbZG, and
 * after Gehen the end of the rest under § 5 ArbZG. `inMinuten` from now, `um` the instant.
 */
export type Ausblick =
  | {
      art: "pause";
      regel: "R-04";
      norm: "§ 4 ArbZG";
      inMinuten: number;
      um: number;
      /** the break minutes owed then: up to 30 or 45, or one Ruhepause of 15 after six hours in a row */
      minuten: number;
    }
  | {
      art: "acht_stunden" | "zehn_stunden";
      regel: "R-02";
      norm: "§ 3 ArbZG";
      inMinuten: number;
      um: number;
    }
  | { art: "ruhezeit"; regel: "R-05"; norm: "§ 5 Abs. 1 ArbZG"; inMinuten: number; um: number };

const MINUTE = 60_000;
/** § 4 Satz 2 ArbZG: a Ruhepause lasts at least 15 minutes */
const KLEINSTE_RUHEPAUSE = 15;

type Kandidat = { inMinuten: number; ausblick: (um: number) => Ausblick };

const pause = (inMinuten: number, minuten: number): Kandidat => ({
  inMinuten,
  ausblick: (um) => ({ art: "pause", regel: "R-04", norm: "§ 4 ArbZG", inMinuten, um, minuten }),
});

const stunden = (art: "acht_stunden" | "zehn_stunden", inMinuten: number): Kandidat => ({
  inMinuten,
  ausblick: (um) => ({ art, regel: "R-02", norm: "§ 3 ArbZG", inMinuten, um }),
});

/**
 * The breaks owed ahead under § 4 ArbZG: each step of Satz 1 not reached yet whose minutes are not
 * taken, and a Ruhepause before the running block passes six hours (Satz 3)
 */
const pausen = (schicht: Schicht, grenzen: ArbzgGrenzen): Kandidat[] => {
  const genommen = schicht.pausenMinuten;
  const stufen = grenzen.pausen
    .filter((stufe) => schicht.arbeitsMinuten <= stufe.ab && genommen < stufe.minuten)
    .map((stufe) => pause(stufe.ab - schicht.arbeitsMinuten, stufe.minuten - genommen));
  const block = schicht.bloecke.at(-1)?.minuten ?? 0;
  const amStueck =
    block <= grenzen.hintereinander
      ? [pause(grenzen.hintereinander - block, KLEINSTE_RUHEPAUSE)]
      : [];
  return [...stufen, ...amStueck];
};

/** The soonest; of two at the same minute the break first, and of two breaks the longer */
const erster = (kandidaten: readonly Kandidat[], jetzt: number): Ausblick | null => {
  const sortiert = [...kandidaten].sort((a, b) => a.inMinuten - b.inMinuten);
  const naechster = sortiert[0];
  if (naechster === undefined) return null;
  const gleichzeitig = sortiert.filter((kandidat) => kandidat.inMinuten === naechster.inMinuten);
  const ausblicke = gleichzeitig.map((kandidat) =>
    kandidat.ausblick(jetzt + kandidat.inMinuten * MINUTE),
  );
  const breiteste = ausblicke
    .filter((ausblick) => ausblick.art === "pause")
    .sort((a, b) => (b.art === "pause" ? b.minuten : 0) - (a.art === "pause" ? a.minuten : 0))[0];
  return breiteste ?? ausblicke[0] ?? null;
};

/**
 * While working: the next limit of the running shift (counted as if it ended now, the minute begun
 * included) and of the day, whose minutes are `tagesMinuten`
 */
export const ausblickBeiArbeit = (
  schicht: Schicht,
  tagesMinuten: number,
  grenzen: ArbzgGrenzen,
  jetzt: number,
): Ausblick | null => {
  const tag = [
    ...(tagesMinuten <= grenzen.werktaeglich
      ? [stunden("acht_stunden", grenzen.werktaeglich - tagesMinuten)]
      : []),
    ...(tagesMinuten <= grenzen.verlaengert
      ? [stunden("zehn_stunden", grenzen.verlaengert - tagesMinuten)]
      : []),
  ];
  return erster([...pausen(schicht, grenzen), ...tag], jetzt);
};

/** While out: the end of the rest of § 5 Abs. 1 ArbZG after the last Gehen, while it is ahead */
export const ruheAusblick = (
  tage: readonly Arbeitstag[],
  grenzen: ArbzgGrenzen,
  jetzt: number,
): Ausblick | null => {
  const letzte = tage.at(-1)?.schichten.at(-1);
  if (letzte?.ende == null) return null;
  const um = letzte.ende + grenzen.ruhezeit * MINUTE;
  if (um <= jetzt) return null;
  return {
    art: "ruhezeit",
    regel: "R-05",
    norm: "§ 5 Abs. 1 ArbZG",
    inMinuten: Math.ceil((um - jetzt) / MINUTE),
    um,
  };
};
