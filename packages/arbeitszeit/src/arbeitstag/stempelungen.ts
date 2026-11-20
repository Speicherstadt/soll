import { alsArray, type Liste, vorne } from "./liste.ts";
import { beginntSchicht, LAENGSTE_SCHICHT, NEUE_SCHICHT_AB } from "./schichten.ts";

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

/**
 * A stretch of work as stamped, in milliseconds; `ende` is null while it runs, `nachPause` when it
 * ended a break (Pause-Ende, or Kommen during the break)
 */
export type Rohstueck = {
  beginn: number;
  ende: number | null;
  endetMit: "gehen" | "pause_beginn" | null;
  nachPause: boolean;
};

export type Stempelfehler = "kommen_fehlt" | "pause_beginn_fehlt" | "pause_ende_fehlt" | "doppelt";

/** A stamp that did not fit, with the stretch it belongs to (null: none) */
export type Rohbefund = { art: Stempelfehler; zeitpunkt: number; stueck: number | null };

type Zustand = "aus" | "arbeit" | "pause";

/** The stamps read: the stretches, the findings and how the last stamp left the person */
export type Lauf = {
  zustand: Zustand;
  stuecke: Rohstueck[];
  befunde: Rohbefund[];
  /** the stretches whose shift was left with a break running: it stays open, never ended */
  offenePausen: number[];
};

/** The run while reading: the lists newest first, so each stamp takes constant time */
type Stand = {
  zustand: Zustand;
  stuecke: Liste<Rohstueck>;
  anzahl: number;
  /** the start of the first stretch of the last shift, as `schichtgruppen` cuts them */
  schichtBeginn: number | null;
  befunde: Liste<Rohbefund>;
  offenePausen: Liste<number>;
  /** the last stamp taken, to tell a repeated stamp */
  letzte: Stempelung | null;
  /** the last stamp read, taken or reported, to tell a double tap */
  zuletzt: Stempelung | null;
};

const MINUTE = 60_000;
const START: Stand = {
  zustand: "aus",
  stuecke: null,
  anzahl: 0,
  schichtBeginn: null,
  befunde: null,
  offenePausen: null,
  letzte: null,
  zuletzt: null,
};

/** What each state expects next; used to order stamps of the same instant */
const PASST: Record<Zustand, readonly Stempelart[]> = {
  aus: ["kommen"],
  arbeit: ["gehen", "pause_beginn"],
  pause: ["pause_ende", "kommen"],
};

const letzterIndex = (lauf: Stand): number | null => (lauf.anzahl > 0 ? lauf.anzahl - 1 : null);

const letztesStueck = (lauf: Stand): Rohstueck | undefined => lauf.stuecke?.kopf;

const beginne = (lauf: Stand, stempel: Stempelung): Stand => {
  const vorher = letztesStueck(lauf);
  const neu = lauf.schichtBeginn === null || vorher === undefined;
  return {
    ...lauf,
    zustand: "arbeit",
    stuecke: vorne(lauf.stuecke, {
      beginn: stempel.zeitpunkt,
      ende: null,
      endetMit: null,
      nachPause: lauf.zustand === "pause",
    }),
    anzahl: lauf.anzahl + 1,
    schichtBeginn:
      neu || beginntSchicht(lauf.schichtBeginn as number, vorher, stempel.zeitpunkt)
        ? stempel.zeitpunkt
        : lauf.schichtBeginn,
    letzte: stempel,
  };
};

/** Ends the last stretch at this stamp; a repeated end moves it there, the later end counting */
const beende = (lauf: Stand, stempel: Stempelung, zustand: Zustand): Stand => {
  const endetMit: Rohstueck["endetMit"] = stempel.art === "gehen" ? "gehen" : "pause_beginn";
  const stuecke =
    lauf.stuecke === null
      ? null
      : vorne(lauf.stuecke.rest, { ...lauf.stuecke.kopf, ende: stempel.zeitpunkt, endetMit });
  return { ...lauf, zustand, stuecke, letzte: stempel };
};

const gleicheMinute = (vorher: Stempelung | null, stempel: Stempelung): boolean =>
  vorher?.art === stempel.art &&
  Math.floor(vorher.zeitpunkt / MINUTE) === Math.floor(stempel.zeitpunkt / MINUTE);

/**
 * The same kind again within the same minute is a double tap or a resent stamp, not a finding: of
 * the last stamp taken, and of the last one read when that was itself reported, which then stands
 * for both
 */
const wiederholt = (lauf: Stand, stempel: Stempelung): boolean =>
  gleicheMinute(lauf.letzte, stempel) || gleicheMinute(lauf.zuletzt, stempel);

const melde = (lauf: Stand, art: Stempelfehler, stempel: Stempelung): Stand =>
  wiederholt(lauf, stempel)
    ? lauf
    : {
        ...lauf,
        befunde: vorne(lauf.befunde, {
          art,
          zeitpunkt: stempel.zeitpunkt,
          // a stamp without Kommen belongs to no stretch; every other one to the last
          stueck: art === "kommen_fehlt" ? null : letzterIndex(lauf),
        }),
      };

/**
 * Whether a stamp lies outside the last shift: an end may fall 24 h after its start at the latest, a
 * start from 24 h on begins a new shift, as `schichtgruppen` cuts them
 */
const nachDerSchicht = (lauf: Stand, { art, zeitpunkt }: Stempelung): boolean => {
  const beginn = lauf.schichtBeginn;
  if (beginn === null) return false;
  const beginnt = art === "kommen" || art === "pause_ende";
  return (
    zeitpunkt - beginn > LAENGSTE_SCHICHT || (beginnt && zeitpunkt - beginn >= LAENGSTE_SCHICHT)
  );
};

/**
 * Whether an end comes 9 h or more after the last stretch ended: that much time off ends the shift
 * (`schichtgruppen`), so the end cannot repeat the last one
 */
const nachDerRuhe = (lauf: Stand, { zeitpunkt }: Stempelung): boolean => {
  const ende = letztesStueck(lauf)?.ende;
  return ende !== null && ende !== undefined && zeitpunkt - ende >= NEUE_SCHICHT_AB;
};

/**
 * A stamp outside a running shift cannot end it (docs/regeln.md, Grundbegriff "Schicht"): the shift
 * is left as it is, open, and the stamp is read as if none were running. Nothing is guessed. A
 * break of 9 h or more is time off, so a stamp after it other than Gehen (which reports the missing
 * end itself) cannot end the break.
 */
const lasseOffen = (lauf: Stand, stempel: Stempelung): Stand => {
  const ausserhalb =
    nachDerSchicht(lauf, stempel) ||
    (lauf.zustand === "pause" && stempel.art !== "gehen" && nachDerRuhe(lauf, stempel));
  if (lauf.zustand === "aus" || !ausserhalb) return lauf;
  const offenePausen =
    lauf.zustand === "pause" ? vorne(lauf.offenePausen, lauf.anzahl - 1) : lauf.offenePausen;
  return { ...lauf, zustand: "aus", offenePausen };
};

/**
 * One stamp. A repeated stamp counts in the way that gives more working time, as the cut to whole
 * minutes does: the earliest start (Kommen, Pause-Ende) and the latest end (Gehen, Pause-Beginn).
 * A double tap within the minute changes nothing, so the first tap counts: a later one would move
 * the end, and with it the 9 h after which the shift ends.
 */
const lies = (vorher: Stand, stempel: Stempelung): Stand => {
  if (wiederholt(vorher, stempel)) return vorher;
  const lauf = lasseOffen(vorher, stempel);
  const { art } = stempel;
  if (lauf.zustand === "aus") {
    if (art === "kommen") return beginne(lauf, stempel);
    const wiederholbar = !nachDerSchicht(lauf, stempel) && !nachDerRuhe(lauf, stempel);
    if (art === "gehen" && lauf.letzte?.art === "gehen" && wiederholbar) {
      // the later Gehen counts only when the work ended with Gehen, never across a break
      const gemeldet = melde(lauf, "doppelt", stempel);
      const mitGehen = letztesStueck(lauf)?.endetMit === "gehen";
      return mitGehen ? beende(gemeldet, stempel, "aus") : { ...gemeldet, letzte: stempel };
    }
    return melde(lauf, "kommen_fehlt", stempel);
  }
  if (lauf.zustand === "arbeit") {
    if (art === "gehen") return beende(lauf, stempel, "aus");
    if (art === "pause_beginn") return beende(lauf, stempel, "pause");
    // a Pause-Ende after the break was ended, by Pause-Ende or by Kommen, repeats that end
    const fehlt = art === "pause_ende" && letztesStueck(lauf)?.nachPause !== true;
    return melde(lauf, fehlt ? "pause_beginn_fehlt" : "doppelt", stempel);
  }
  // Kommen after a break ends it: a terminal may offer only Kommen and Gehen
  if (art === "pause_ende" || art === "kommen") return beginne(lauf, stempel);
  if (art === "pause_beginn") return beende(melde(lauf, "doppelt", stempel), stempel, "pause");
  // Gehen during a break: when the break ended is unknown, so the work counts up to its start
  return { ...melde(lauf, "pause_ende_fehlt", stempel), zustand: "aus", letzte: stempel };
};

const schritt = (lauf: Stand, stempel: Stempelung): Stand => ({
  ...lies(lauf, stempel),
  zuletzt: stempel,
});

const RANG: Record<Stempelart, number> = { gehen: 0, pause_beginn: 1, pause_ende: 2, kommen: 3 };

/** A stamp resent with its kind and instant is the same stamp: it is read once */
const einmal = (stempelungen: readonly Stempelung[]): Stempelung[] => {
  const gesehen = new Set<string>();
  return stempelungen.filter((stempel) => {
    const schluessel = `${stempel.art} ${stempel.zeitpunkt}`;
    if (gesehen.has(schluessel)) return false;
    gesehen.add(schluessel);
    return true;
  });
};

/**
 * Reads the stamps of one instant in the order the current state expects; there are at most four,
 * one of each kind, once `einmal` has run
 */
const liesGleichzeitige = (lauf: Stand, gleichzeitig: readonly Stempelung[]): Stand => {
  let stand = lauf;
  let rest = gleichzeitig;
  while (rest.length > 0) {
    const zustand = stand.zustand;
    const passend = rest.findIndex((stempel) => PASST[zustand].includes(stempel.art));
    const index = passend === -1 ? 0 : passend;
    stand = schritt(stand, rest[index] as Stempelung);
    rest = rest.filter((_, i) => i !== index);
  }
  return stand;
};

/**
 * Runs the stamps in time order. Stamps of the same instant are taken in the order the current
 * state expects (Gehen, then Kommen when one pair ends as the next begins), so the result does not
 * depend on the order they arrive in, nor on a stamp sent twice.
 */
export const durchlaufe = (stempelungen: readonly Stempelung[]): Lauf => {
  const sortiert = einmal(stempelungen).sort(
    (a, b) => a.zeitpunkt - b.zeitpunkt || RANG[a.art] - RANG[b.art],
  );
  let stand = START;
  let von = 0;
  while (von < sortiert.length) {
    const zeit = sortiert[von]?.zeitpunkt;
    let bis = von + 1;
    while (sortiert[bis]?.zeitpunkt === zeit) bis += 1;
    stand = liesGleichzeitige(stand, sortiert.slice(von, bis));
    von = bis;
  }
  return {
    zustand: stand.zustand,
    stuecke: alsArray(stand.stuecke),
    befunde: alsArray(stand.befunde),
    offenePausen: alsArray(stand.offenePausen),
  };
};
