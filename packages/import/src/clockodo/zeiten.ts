import type { ImportZeit, LeseFehler } from "../modell.ts";
import { type Eintrag, ZEITEINTRAG } from "./bestand.ts";
import { berlinerUhr } from "./uhr.ts";

/*
 * Clockodo's time entries as spans of work (BAULISTE.md S-703). Clockodo keeps one entry per task;
 * the gap between two entries is a break as the person clocked it. So the entries of a person that
 * touch or overlap become one block, each block one span with Kommen and Gehen and no break of its
 * own, and the gaps stay where they were. Begins are rounded down to the minute and ends up, so the
 * time never shrinks (CLAUDE.md: never round to the employee's disadvantage).
 */

const MINUTE = 60_000;
const TAG = 24 * 60 * MINUTE;

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

/** The blocks of one person's entries in time order: touching or overlapping ones merged */
const zusammenfassen = (bloecke: readonly Block[]): Block[] => {
  const sortiert = [...bloecke].sort((a, b) => a.beginn - b.beginn || a.zeile - b.zeile);
  const ergebnis: Block[] = [];
  for (const block of sortiert) {
    const letzter = ergebnis.at(-1);
    if (letzter && block.beginn <= letzter.ende) letzter.ende = Math.max(letzter.ende, block.ende);
    else ergebnis.push({ ...block });
  }
  return ergebnis;
};

type Uhr = ReturnType<typeof berlinerUhr>;

/** A block as a span on Berlin's clock, or why a day and two times cannot name it */
const alsZeit = (block: Block, person: string, uhr: Uhr): ImportZeit | LeseFehler => {
  const { zeile } = block;
  if (block.ende - block.beginn >= TAG)
    return { zeile, grund: "zeit_ungueltig", feld: "time_until" };
  if (uhr.doppelt(block.beginn)) return { zeile, grund: "zeit_ungueltig", feld: "time_since" };
  if (uhr.doppelt(block.ende)) return { zeile, grund: "zeit_ungueltig", feld: "time_until" };
  const beginn = uhr.uhr(block.beginn);
  return {
    externalId: block.id,
    zeile,
    person,
    tag: beginn.tag,
    beginn: beginn.minute,
    ende: uhr.uhr(block.ende).minute,
    pauseMinuten: 0,
  };
};

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
    for (const block of zusammenfassen(bloecke)) {
      const zeit = alsZeit(block, person(nutzer), uhr);
      if ("grund" in zeit) fehler.push(zeit);
      else zeiten.push(zeit);
    }
  return { zeiten: zeiten.sort((a, b) => a.zeile - b.zeile), fehler };
};
