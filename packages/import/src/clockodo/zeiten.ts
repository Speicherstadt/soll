import type { ImportZeit, LeseFehler } from "../modell.ts";
import { MINUTE, spanneAlsZeit, zusammenfassen } from "../spanne.ts";
import { berlinerUhr } from "../uhr.ts";
import { type Eintrag, ZEITEINTRAG } from "./bestand.ts";

/*
 * Clockodo's time entries as spans of work (BAULISTE.md S-703). Clockodo keeps one entry per task;
 * the gap between two entries is a break as the person clocked it. So the entries of a person that
 * touch or overlap become one block, each block one span with Kommen and Gehen and no break of its
 * own, and the gaps stay where they were. Begins are rounded down to the minute and ends up, so the
 * time never shrinks (CLAUDE.md: never round to the employee's disadvantage).
 */

type Block = { zeile: number; id: string; nutzer: string; beginn: number; ende: number };

/** An entry Soll takes as time on whole minutes, or the reason it cannot */
const alsBlock = (eintrag: Eintrag): Block | LeseFehler => {
  const { zeile } = eintrag;
  if (eintrag.ende === null) return { zeile, grund: "laeuft_noch", feld: "time_until" };
  if (eintrag.korrektur !== 0)
    return { zeile, grund: "korrektur", feld: "offset", wert: String(eintrag.korrektur) };
  const beginn = Math.floor(eintrag.beginn / MINUTE) * MINUTE;
  const ende = Math.ceil(eintrag.ende / MINUTE) * MINUTE;
  if (ende <= beginn) return { zeile, grund: "zeit_ungueltig", feld: "time_until" };
  return { zeile, id: eintrag.id, nutzer: eintrag.nutzer, beginn, ende };
};

/**
 * Entries in time order; of two that begin in the same minute the lower Clockodo id first, so the
 * id of a block does not hang on the order of the lines in a file
 */
const zeitfolge = (a: Block, b: Block): number =>
  a.beginn - b.beginn || Number(a.id) - Number(b.id) || a.id.localeCompare(b.id);

const FELDER = { beginn: "time_since", ende: "time_until" };

/**
 * The spans of work of all time entries; lump sums are no working time and are left out.
 * `person` names a user by Clockodo's id.
 */
export const zeitenAus = (
  eintraege: readonly Eintrag[],
  person: (nutzer: string) => string,
): { zeiten: ImportZeit[]; fehler: LeseFehler[] } => {
  const fehler: LeseFehler[] = [];
  const jeNutzer = new Map<string, Block[]>();
  for (const eintrag of eintraege) {
    if (eintrag.typ !== ZEITEINTRAG) continue;
    const block = alsBlock(eintrag);
    if ("grund" in block) fehler.push(block);
    else {
      const liste = jeNutzer.get(block.nutzer) ?? [];
      liste.push(block);
      jeNutzer.set(block.nutzer, liste);
    }
  }
  const uhr = berlinerUhr();
  const zeiten: ImportZeit[] = [];
  for (const [nutzer, bloecke] of jeNutzer)
    for (const block of zusammenfassen(bloecke, zeitfolge)) {
      const zeit = spanneAlsZeit(block, person(nutzer), uhr, FELDER);
      if ("grund" in zeit) fehler.push(zeit);
      else zeiten.push(zeit);
    }
  return { zeiten: zeiten.sort((a, b) => a.zeile - b.zeile), fehler };
};
