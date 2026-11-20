import { LAENGSTE_SCHICHT, NEUE_SCHICHT_AB, schichtgruppen } from "./schichten.ts";

/**
 * Reads clock stamps in time order into stretches of work (docs/regeln.md, R-01). Nothing here is
 * guessed: a stamp that does not fit is reported, never replaced by an invented one, and an open
 * stretch stays open (CLAUDE.md: never stamp out automatically).
 */
export type Stempelart = "kommen" | "gehen" | "pause_beginn" | "pause_ende";
export const STEMPELARTEN: readonly Stempelart[] = [
  "kommen",
  "gehen",
  "pause_beginn",
  "pause_ende",
];

/** A clock stamp: its kind and its instant in UTC milliseconds */
export type Stempelung = { art: Stempelart; zeitpunkt: number };

/** A stretch of work as stamped, in milliseconds; `ende` is null while it runs */
export type Rohstueck = {
  beginn: number;
  ende: number | null;
  endetMit: "gehen" | "pause_beginn" | null;
};

export type Stempelfehler = "kommen_fehlt" | "pause_beginn_fehlt" | "pause_ende_fehlt" | "doppelt";

/** A stamp that did not fit, with the stretch it belongs to (null: none) */
export type Rohbefund = { art: Stempelfehler; zeitpunkt: number; stueck: number | null };

type Zustand = "aus" | "arbeit" | "pause";

export type Lauf = {
  zustand: Zustand;
  stuecke: Rohstueck[];
  befunde: Rohbefund[];
  /** the stretches whose shift was left with a break running: it stays open, never ended */
  offenePausen: number[];
  /** the last stamp taken, to tell a repeated stamp */
  letzte: Stempelung | null;
};

const MINUTE = 60_000;
const START: Lauf = { zustand: "aus", stuecke: [], befunde: [], offenePausen: [], letzte: null };

/** What each state expects next; used to order stamps of the same instant */
const PASST: Record<Zustand, readonly Stempelart[]> = {
  aus: ["kommen"],
  arbeit: ["gehen", "pause_beginn"],
  pause: ["pause_ende", "kommen"],
};

const letzterIndex = (lauf: Lauf): number | null =>
  lauf.stuecke.length > 0 ? lauf.stuecke.length - 1 : null;

const beginne = (lauf: Lauf, stempel: Stempelung): Lauf => ({
  ...lauf,
  zustand: "arbeit",
  stuecke: [...lauf.stuecke, { beginn: stempel.zeitpunkt, ende: null, endetMit: null }],
  letzte: stempel,
});

/** Ends the last stretch at this stamp; a repeated end moves it there, the later end counting */
const beende = (lauf: Lauf, stempel: Stempelung, zustand: Zustand): Lauf => {
  const endetMit: Rohstueck["endetMit"] = stempel.art === "gehen" ? "gehen" : "pause_beginn";
  const stuecke = lauf.stuecke.map((stueck, index) =>
    index === lauf.stuecke.length - 1 ? { ...stueck, ende: stempel.zeitpunkt, endetMit } : stueck,
  );
  return { ...lauf, zustand, stuecke, letzte: stempel };
};

/** The same kind again within the same minute is a double tap or a resent stamp, not a finding */
const wiederholt = (lauf: Lauf, stempel: Stempelung): boolean =>
  lauf.letzte?.art === stempel.art &&
  Math.floor(lauf.letzte.zeitpunkt / MINUTE) === Math.floor(stempel.zeitpunkt / MINUTE);

const melde = (lauf: Lauf, art: Stempelfehler, stempel: Stempelung): Lauf =>
  art === "doppelt" && wiederholt(lauf, stempel)
    ? lauf
    : {
        ...lauf,
        befunde: [
          ...lauf.befunde,
          {
            art,
            zeitpunkt: stempel.zeitpunkt,
            // a stamp without Kommen belongs to no stretch; every other one to the last
            stueck: art === "kommen_fehlt" ? null : letzterIndex(lauf),
          },
        ],
      };

/**
 * Whether a stamp lies outside the last shift: an end may fall 24 h after its start at the latest, a
 * start from 24 h on begins a new shift, as `schichtgruppen` cuts them
 */
const nachDerSchicht = (lauf: Lauf, { art, zeitpunkt }: Stempelung): boolean => {
  const erstes = schichtgruppen(lauf.stuecke).at(-1)?.[0];
  const beginn = erstes === undefined ? undefined : lauf.stuecke[erstes]?.beginn;
  if (beginn === undefined) return false;
  const beginnt = art === "kommen" || art === "pause_ende";
  return (
    zeitpunkt - beginn > LAENGSTE_SCHICHT || (beginnt && zeitpunkt - beginn >= LAENGSTE_SCHICHT)
  );
};

/**
 * Whether an end comes 9 h or more after the last stretch ended: that much time off ends the shift
 * (`schichtgruppen`), so the end cannot repeat the last one
 */
const nachDerRuhe = (lauf: Lauf, { zeitpunkt }: Stempelung): boolean => {
  const ende = lauf.stuecke.at(-1)?.ende;
  return ende !== null && ende !== undefined && zeitpunkt - ende >= NEUE_SCHICHT_AB;
};

/**
 * A stamp outside a running shift cannot end it (docs/regeln.md, Grundbegriff "Schicht"): the shift
 * is left as it is, open, and the stamp is read as if none were running. Nothing is guessed.
 */
const lasseOffen = (lauf: Lauf, stempel: Stempelung): Lauf => {
  const ausserhalb =
    nachDerSchicht(lauf, stempel) ||
    (lauf.zustand === "pause" && stempel.art === "pause_beginn" && nachDerRuhe(lauf, stempel));
  if (lauf.zustand === "aus" || !ausserhalb) return lauf;
  const letztes = lauf.stuecke.length - 1;
  const offenePausen =
    lauf.zustand === "pause" ? [...lauf.offenePausen, letztes] : lauf.offenePausen;
  return { ...lauf, zustand: "aus", offenePausen };
};

/**
 * One stamp. A repeated stamp counts in the way that gives more working time, as the cut to whole
 * minutes does: the earliest start (Kommen, Pause-Ende) and the latest end (Gehen, Pause-Beginn).
 */
const schritt = (vorher: Lauf, stempel: Stempelung): Lauf => {
  const lauf = lasseOffen(vorher, stempel);
  const { art } = stempel;
  if (lauf.zustand === "aus") {
    if (art === "kommen") return beginne(lauf, stempel);
    const wiederholbar = !nachDerSchicht(lauf, stempel) && !nachDerRuhe(lauf, stempel);
    if (art === "gehen" && lauf.letzte?.art === "gehen" && wiederholbar) {
      // the later Gehen counts only when the work ended with Gehen, never across a break
      const gemeldet = melde(lauf, "doppelt", stempel);
      const mitGehen = lauf.stuecke.at(-1)?.endetMit === "gehen";
      return mitGehen ? beende(gemeldet, stempel, "aus") : { ...gemeldet, letzte: stempel };
    }
    return melde(lauf, "kommen_fehlt", stempel);
  }
  if (lauf.zustand === "arbeit") {
    if (art === "gehen") return beende(lauf, stempel, "aus");
    if (art === "pause_beginn") return beende(lauf, stempel, "pause");
    const fehlt = art === "pause_ende" && lauf.letzte?.art !== "pause_ende";
    return melde(lauf, fehlt ? "pause_beginn_fehlt" : "doppelt", stempel);
  }
  // Kommen after a break ends it: a terminal may offer only Kommen and Gehen
  if (art === "pause_ende" || art === "kommen") return beginne(lauf, stempel);
  if (art === "pause_beginn") return beende(melde(lauf, "doppelt", stempel), stempel, "pause");
  // Gehen during a break: when the break ended is unknown, so the work counts up to its start
  return { ...melde(lauf, "pause_ende_fehlt", stempel), zustand: "aus", letzte: stempel };
};

const RANG: Record<Stempelart, number> = { gehen: 0, pause_beginn: 1, pause_ende: 2, kommen: 3 };

/**
 * Runs the stamps in time order. Stamps of the same instant are taken in the order the current
 * state expects (Gehen, then Kommen when one pair ends as the next begins), so the result does not
 * depend on the order they arrive in.
 */
export const durchlaufe = (stempelungen: readonly Stempelung[]): Lauf => {
  let rest = [...stempelungen].sort(
    (a, b) => a.zeitpunkt - b.zeitpunkt || RANG[a.art] - RANG[b.art],
  );
  let lauf = START;
  while (rest.length > 0) {
    const zeit = rest[0]?.zeitpunkt;
    const zustand = lauf.zustand;
    const passend = rest.findIndex(
      (stempel) => stempel.zeitpunkt === zeit && PASST[zustand].includes(stempel.art),
    );
    const index = passend === -1 ? 0 : passend;
    lauf = schritt(lauf, rest[index] as Stempelung);
    rest = rest.filter((_, i) => i !== index);
  }
  return lauf;
};
