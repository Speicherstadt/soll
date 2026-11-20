import { plusTage, type Tag, tagAus, tageZwischen } from "../kalender/tag.ts";
import type { ArbzgGrenzen } from "./grenzen.ts";

/** The two Ausgleichszeiträume of § 3 Satz 2 ArbZG */
export type Zeitraumart = "sechs_monate" | "24_wochen";

/** A period from `von` to `bis`, both days included */
export type Zeitraum = { art: Zeitraumart; von: Tag; bis: Tag };

const monateSeitNull = (tag: Tag): number =>
  Number(tag.slice(0, 4)) * 12 + Number(tag.slice(5, 7)) - 1;

const ersterImMonat = (monate: number): Tag =>
  tagAus(Math.floor(monate / 12), (monate % 12) + 1, 1);

/**
 * The period a day falls in. Periods follow each other without gap from `beginn`, also backwards:
 * six calendar months from the first of `beginn`'s month (calendar months begin on the first), 24
 * weeks from `beginn` itself.
 */
export const zeitraumAm = (
  tag: Tag,
  art: Zeitraumart,
  beginn: Tag,
  grenzen: ArbzgGrenzen,
): Zeitraum => {
  if (art === "24_wochen") {
    const laenge = grenzen.ausgleichWochen * 7;
    const von = plusTage(beginn, Math.floor(tageZwischen(beginn, tag) / laenge) * laenge);
    return { art, von, bis: plusTage(von, laenge - 1) };
  }
  const laenge = grenzen.ausgleichMonate;
  const anfang = monateSeitNull(beginn);
  const start = anfang + Math.floor((monateSeitNull(tag) - anfang) / laenge) * laenge;
  return {
    art,
    von: ersterImMonat(start),
    bis: plusTage(ersterImMonat(start + laenge), -1),
  };
};

/** Every day from `von` to `bis`, both included */
export const tageVonBis = (von: Tag, bis: Tag): Tag[] =>
  Array.from({ length: Math.max(0, tageZwischen(von, bis) + 1) }, (_, index) =>
    plusTage(von, index),
  );

export const ueberschneiden = (a: Zeitraum, b: Zeitraum): boolean =>
  a.von <= b.bis && b.von <= a.bis;

/** The later of two days */
export const spaeterer = (a: Tag, b: Tag): Tag => (a.localeCompare(b) >= 0 ? a : b);
