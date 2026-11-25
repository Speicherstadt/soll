import type { LeseFehler } from "../modell.ts";
import type { Zeitbuchung } from "./bestand.ts";

/*
 * The pieces of work of Kimai's timesheets (BAULISTE.md S-705). Kimai keeps a break per timesheet
 * as a number of seconds (`break`, Entity/Timesheet.php since migration Version20240926111739),
 * not when it was; so the break lies in the middle of the timesheet, as Soll places a break it
 * does not know the time of (S-502, S-701). Begin rounded down to the minute, end up, the break
 * down: the time never shrinks (CLAUDE.md: never round to the employee's disadvantage).
 */

export const MINUTE = 60_000;

/** A piece of a timesheet: the first, or the second after its break */
export type Stueck = {
  zeile: number;
  /** the timesheet's id; a second piece "<id>-2" */
  id: string;
  buchung: Zeitbuchung;
  nummer: 1 | 2;
  beginn: number;
  ende: number;
};

/** The pieces of one finished timesheet, or why it gives none */
export const stueckeVon = (buchung: Zeitbuchung): Stueck[] | LeseFehler => {
  const { zeile } = buchung;
  if (buchung.ende === null) return { zeile, grund: "laeuft_noch", feld: "end" };
  const beginn = Math.floor(buchung.beginn / MINUTE) * MINUTE;
  const ende = Math.ceil(buchung.ende / MINUTE) * MINUTE;
  if (ende <= beginn) return { zeile, grund: "zeit_ungueltig", feld: "end" };
  const pause = Math.floor(buchung.pauseSekunden / 60) * MINUTE;
  const stueck = (nummer: 1 | 2, von: number, bis: number): Stueck => ({
    zeile,
    id: nummer === 1 ? buchung.id : `${buchung.id}-2`,
    buchung,
    nummer,
    beginn: von,
    ende: bis,
  });
  if (pause === 0) return [stueck(1, beginn, ende)];
  if (pause >= ende - beginn)
    return { zeile, grund: "pause_ungueltig", feld: "break", wert: String(buchung.pauseSekunden) };
  const pauseBeginn = beginn + Math.floor((ende - beginn - pause) / 2 / MINUTE) * MINUTE;
  return [stueck(1, beginn, pauseBeginn), stueck(2, pauseBeginn + pause, ende)];
};

/**
 * Pieces in time order; of two that begin in the same minute the lower Kimai id first, so the id
 * of a block does not hang on the order of the lines in a file
 */
export const zeitfolge = (a: Stueck, b: Stueck): number =>
  a.beginn - b.beginn || Number(a.buchung.id) - Number(b.buchung.id) || a.nummer - b.nummer;

/** A block of touching or overlapping pieces of one person, named by its first piece */
export type Block = { zeile: number; id: string; beginn: number; ende: number; stuecke: Stueck[] };

/** The blocks of one person's pieces in time order */
export const zusammenfassen = (stuecke: readonly Stueck[]): Block[] => {
  const bloecke: Block[] = [];
  for (const stueck of [...stuecke].sort(zeitfolge)) {
    const letzter = bloecke.at(-1);
    if (letzter && stueck.beginn <= letzter.ende) {
      letzter.ende = Math.max(letzter.ende, stueck.ende);
      letzter.stuecke.push(stueck);
    } else
      bloecke.push({
        zeile: stueck.zeile,
        id: stueck.id,
        beginn: stueck.beginn,
        ende: stueck.ende,
        stuecke: [stueck],
      });
  }
  return bloecke;
};
