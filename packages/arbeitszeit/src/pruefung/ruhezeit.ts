import type { Stueck } from "../arbeitstag/schichten.ts";
import type { Befund } from "../befund.ts";
import { plusTage, type Tag, tagAus } from "../kalender/tag.ts";
import { beginnInBerlin, tagInBerlin } from "../kalender/zeit.ts";
import { type ArbzgGrenzen, arbzgGrenzenAm, type Branche } from "./grenzen.ts";
import { type Pruefergebnis, type PruefSchicht, type PruefTag, sortiert } from "./typen.ts";
import { spaeterer } from "./zeitraeume.ts";

/**
 * Where the 12-hour rest that balances a shortened one must lie (§ 5 Abs. 2 ArbZG): within the
 * calendar month or within four weeks. The business chooses; without a choice either will do, as in
 * R-03, so Soll reports only when both have passed.
 */
export type RuhezeitAusgleich = "kalendermonat" | "vier_wochen" | "beide";

export type RuhezeitOptionen = {
  /** decides whether a window for the balancing rest has passed and how long the rest since the last Gehen is */
  jetzt: number;
  /** default "andere": no shortening under § 5 Abs. 2 ArbZG */
  branche?: Branche;
  /** default "beide" */
  ausgleich?: RuhezeitAusgleich;
};

/**
 * R-05: a rest shorter than allowed (Verstoß), a rest shortened under § 5 Abs. 2 ArbZG that still
 * needs its balance by `ausgleichBis` (Hinweis), or one whose balance did not come (Verstoß).
 * `mindestens` is the shortest rest allowed, `fehlt` the minutes short of it, for a shortened rest
 * the minutes short of 11 hours.
 */
export type RuhezeitBefund = Befund<
  "ruhezeit_zu_kurz" | "ruhezeit_verkuerzt" | "ruhezeit_ausgleich_fehlt"
> & {
  ruhe: Stueck;
  mindestens: number;
  fehlt: number;
  ausgleichBis?: Tag;
};

const MINUTE = 60_000;

/** A rest from the end of a working day to the next; `bis` null for the rest still running at `jetzt` */
export type Ruhe = { von: Tag; bis: Tag | null; beginn: number; ende: number; minuten: number };

/**
 * A piece of work a rest can follow or end: a whole shift, or a block of a shift with call-outs;
 * `ersteDerSchicht` for the first piece of its shift that is not a call-out
 */
type Stelle = {
  tag: Tag;
  beginn: number;
  ende: number | null;
  einsatz: boolean;
  ersteDerSchicht: boolean;
};

const imEinsatz = (schicht: PruefSchicht, block: Stueck): boolean =>
  (schicht.einsaetze ?? []).some(
    (einsatz) => einsatz.beginn <= block.beginn && block.ende <= einsatz.ende,
  );

/**
 * The pieces of a shift: the whole shift (no end while it is open), or, when it holds call-outs in
 * Rufbereitschaft (R-12), each block, so that a call-out's end begins a rest of its own
 */
const stellen = (schicht: PruefSchicht): Stelle[] => {
  const { tag } = schicht;
  if (schicht.ende === null || (schicht.einsaetze ?? []).length === 0)
    return [
      { tag, beginn: schicht.beginn, ende: schicht.ende, einsatz: false, ersteDerSchicht: true },
    ];
  const bloecke = schicht.bloecke.map((block) => ({ block, einsatz: imEinsatz(schicht, block) }));
  const erste = bloecke.find((teil) => !teil.einsatz);
  return bloecke.map((teil) => ({
    tag,
    beginn: teil.block.beginn,
    ende: teil.block.ende,
    einsatz: teil.einsatz,
    ersteDerSchicht: teil === erste,
  }));
};

/**
 * The pieces whose start ends the rest before them: the first piece of each shift that is not a
 * call-out, whatever its calendar day (two shifts of one day are two working days by the 9 hours of
 * S-201); after a call-out a new rest begins (R-12)
 */
const ersteArbeit = (stellen: readonly Stelle[]): Set<Stelle> =>
  new Set(stellen.filter((stelle) => stelle.ersteDerSchicht && !stelle.einsatz));

/**
 * The rests before each working day (each shift), from the last end of work before it to its first
 * Kommen (docs/regeln.md, R-05), and the rest since the last end of work while nothing has followed
 * yet. A call-out in Rufbereitschaft ends no rest but begins a new one (R-12): the rest that counts
 * is the one after it, up to the next shift. Without call-outs this is the last Gehen of one shift
 * to the first Kommen of the next. The rests of JArbSchG § 13 and MuSchG § 4 Abs. 2 are measured
 * the same way.
 */
export const ruhenAus = (tage: readonly PruefTag[], jetzt: number): Ruhe[] => {
  const alle = tage
    .flatMap((tag) => tag.schichten.flatMap(stellen))
    .sort((a, b) => a.beginn - b.beginn);
  const erste = ersteArbeit(alle);
  const ruhen = alle.flatMap((nach, index): Ruhe[] => {
    const vor = alle[index - 1];
    if (!erste.has(nach) || vor === undefined || vor.ende === null) return [];
    return [
      {
        von: vor.tag,
        bis: nach.tag,
        beginn: vor.ende,
        ende: nach.beginn,
        minuten: (nach.beginn - vor.ende) / MINUTE,
      },
    ];
  });
  const letzte = alle.at(-1);
  const seit = letzte?.ende ?? null;
  if (letzte === undefined || seit === null || jetzt <= seit) return ruhen;
  const minuten = Math.floor((jetzt - seit) / MINUTE);
  return [
    ...ruhen,
    { von: letzte.tag, bis: null, beginn: seit, ende: seit + minuten * MINUTE, minuten },
  ];
};

/** The last day on which the balancing rest may end */
const ausgleichBis = (ruhe: Ruhe, art: RuhezeitAusgleich, grenzen: ArbzgGrenzen): Tag => {
  const tag = tagInBerlin(ruhe.beginn);
  const monat = plusTage(tagAus(Number(tag.slice(0, 4)), Number(tag.slice(5, 7)) + 1, 1), -1);
  const vierWochen = plusTage(tag, grenzen.ausgleichVierWochen - 1);
  if (art === "kalendermonat") return monat;
  if (art === "vier_wochen") return vierWochen;
  return spaeterer(monat, vierWochen);
};

type Verkuerzung = { ruhe: Ruhe; grenzen: ArbzgGrenzen; bis: Tag; fensterEnde: number };

/**
 * Pairs each shortened rest with a later rest of 12 hours or more inside its window, each used once.
 * The windows end in the order the rests begin, so the earliest free rest that fits is the best
 * choice (earliest deadline first). Soll counts only a balance after the shortening (careful
 * reading: the law does not say the balance may come first).
 */
const unausgeglichen = (verkuerzungen: readonly Verkuerzung[], ruhen: readonly Ruhe[]) => {
  const vergeben = new Set<Ruhe>();
  return verkuerzungen.filter(({ ruhe, grenzen, fensterEnde }) => {
    const ausgleich = ruhen.find(
      (kandidat) =>
        !vergeben.has(kandidat) &&
        kandidat.minuten >= grenzen.ruhezeitAusgleich &&
        kandidat.beginn >= ruhe.ende &&
        kandidat.beginn + grenzen.ruhezeitAusgleich * MINUTE <= fensterEnde,
    );
    if (ausgleich !== undefined) vergeben.add(ausgleich);
    return ausgleich === undefined;
  });
};

const befund = (
  art: RuhezeitBefund["art"],
  ruhe: Ruhe,
  norm: string,
  mindestens: number,
  fehlt: number,
): RuhezeitBefund => ({
  regel: "R-05",
  norm,
  schwere: art === "ruhezeit_verkuerzt" ? "hinweis" : "verstoss",
  art,
  tage: sortiert([ruhe.von, ruhe.bis as Tag]),
  ruhe: { beginn: ruhe.beginn, ende: ruhe.ende, minuten: ruhe.minuten },
  mindestens,
  fehlt,
});

/**
 * § 5 ArbZG: at least 11 hours of rest between two working days; in the industries of § 5 Abs. 2
 * at least 10, when each shortening is balanced by a rest of 12 hours (docs/regeln.md, R-05). The
 * limits are those of the day the rest ends on, the day whose work it precedes.
 */
export const ruhezeit = (
  tage: readonly PruefTag[],
  { jetzt, branche = "andere", ausgleich = "beide" }: RuhezeitOptionen,
): Pruefergebnis<RuhezeitBefund> => {
  const ruhen = ruhenAus(tage, jetzt);
  const befunde: RuhezeitBefund[] = [];
  const verkuerzungen: Verkuerzung[] = [];
  const nichtHinterlegt: Tag[] = [];
  for (const ruhe of ruhen) {
    if (ruhe.bis === null) continue;
    const grenzen = arbzgGrenzenAm(ruhe.bis);
    if (grenzen === null) {
      nichtHinterlegt.push(ruhe.bis);
      continue;
    }
    if (ruhe.minuten >= grenzen.ruhezeit) continue;
    const verkuerzbar = grenzen.verkuerzbar.includes(branche);
    const norm = verkuerzbar ? "§ 5 Abs. 2 ArbZG" : "§ 5 Abs. 1 ArbZG";
    const mindestens = verkuerzbar ? grenzen.ruhezeitVerkuerzt : grenzen.ruhezeit;
    if (ruhe.minuten < mindestens) {
      befunde.push(befund("ruhezeit_zu_kurz", ruhe, norm, mindestens, mindestens - ruhe.minuten));
      continue;
    }
    const bis = ausgleichBis(ruhe, ausgleich, grenzen);
    verkuerzungen.push({ ruhe, grenzen, bis, fensterEnde: beginnInBerlin(plusTage(bis, 1)) });
  }
  for (const { ruhe, grenzen, bis, fensterEnde } of unausgeglichen(verkuerzungen, ruhen)) {
    const art = jetzt >= fensterEnde ? "ruhezeit_ausgleich_fehlt" : "ruhezeit_verkuerzt";
    const fehlt = grenzen.ruhezeit - ruhe.minuten;
    befunde.push({
      ...befund(art, ruhe, "§ 5 Abs. 2 ArbZG", grenzen.ruhezeitVerkuerzt, fehlt),
      ausgleichBis: bis,
    });
  }
  return {
    befunde: befunde.sort((a, b) => a.ruhe.beginn - b.ruhe.beginn),
    nichtHinterlegt: sortiert(nichtHinterlegt),
  };
};
