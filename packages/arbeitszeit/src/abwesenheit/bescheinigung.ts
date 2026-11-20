import type { Befund } from "../befund.ts";
import { istTag, plusTage, type Tag } from "../kalender/tag.ts";

/**
 * From which day of a sickness the business wants the certificate: the 4th by law (§ 5 Abs. 1 Satz 2
 * EntgFG), earlier if it asks for it (Satz 3)
 */
export type BescheinigungAbTag = 1 | 2 | 3 | 4;
export const BESCHEINIGUNG_AB_TAG: readonly BescheinigungAbTag[] = [1, 2, 3, 4];
export const BESCHEINIGUNG_GESETZ: BescheinigungAbTag = 4;

/** R-27: the certificate was due on `tage[0]` and is not there yet */
export type BescheinigungBefund = Befund<"bescheinigung_faellig">;

/**
 * Where a sickness stands with its certificate: not needed (it ended before the day), due later (if
 * the person is still sick then), due today, overdue, or there
 */
export type Bescheinigungsstand =
  | "nicht_noetig"
  | "spaeter"
  | "heute"
  | "ueberfaellig"
  | "liegt_vor";

export type Krankheit = { von: Tag; bis: Tag | null; bescheinigung?: boolean };

export type BescheinigungsPruefung = {
  /** the day the certificate is due; null when the sickness ended before it was needed */
  faelligAm: Tag | null;
  stand: Bescheinigungsstand;
  /** remind the business to fetch the eAU through its payroll program (§ 109 SGB IV) */
  eauAbrufen: boolean;
  befunde: BescheinigungBefund[];
};

/** Looking further than a month for a working day would mean the predicate has none */
const SUCHE_TAGE = 31;

const normFuer = (abTag: BescheinigungAbTag): string =>
  abTag === BESCHEINIGUNG_GESETZ ? "§ 5 Abs. 1 Satz 2 EntgFG" : "§ 5 Abs. 1 Satz 3 EntgFG";

/**
 * The day the certificate is due (docs/regeln.md R-27): day 1 is the first day of sickness; once it
 * reaches day `abTag` (by law day 4: „länger als drei Kalendertage“), the certificate is due on the
 * first working day from that day on („an dem darauffolgenden Arbeitstag“). A sickness that ended
 * before that day needs none (null); an open one is due on that day if it lasts.
 */
export const bescheinigungFaellig = (
  krankheit: Pick<Krankheit, "von" | "bis">,
  abTag: BescheinigungAbTag,
  arbeitstag: (tag: Tag) => boolean,
): Tag | null => {
  const stichtag = plusTage(krankheit.von, abTag - 1);
  if (krankheit.bis !== null && krankheit.bis < stichtag) return null;
  for (let schritt = 0; schritt < SUCHE_TAGE; schritt += 1) {
    const tag = plusTage(stichtag, schritt);
    if (arbeitstag(tag)) return tag;
  }
  return stichtag;
};

/**
 * R-27 for a sickness on a day: when the certificate is due, where it stands, whether the business
 * is reminded to fetch the eAU (on the day it is due and after, until it is marked as there), and the
 * finding once the day has passed without it. Soll keeps only that it is there (eAU or paper),
 * never a diagnosis or a file (Art. 9 DSGVO).
 */
export const bescheinigungPruefen = (
  krankheit: Krankheit,
  angaben: { abTag: BescheinigungAbTag; arbeitstag: (tag: Tag) => boolean; heute: Tag },
): BescheinigungsPruefung | null => {
  if (!istTag(krankheit.von) || (krankheit.bis !== null && !istTag(krankheit.bis))) return null;
  if (!istTag(angaben.heute) || !BESCHEINIGUNG_AB_TAG.includes(angaben.abTag)) return null;
  const faelligAm = bescheinigungFaellig(krankheit, angaben.abTag, angaben.arbeitstag);
  if (faelligAm === null)
    return { faelligAm, stand: "nicht_noetig", eauAbrufen: false, befunde: [] };
  if (krankheit.bescheinigung === true)
    return { faelligAm, stand: "liegt_vor", eauAbrufen: false, befunde: [] };
  const stand: Bescheinigungsstand =
    angaben.heute < faelligAm ? "spaeter" : angaben.heute === faelligAm ? "heute" : "ueberfaellig";
  return {
    faelligAm,
    stand,
    eauAbrufen: stand !== "spaeter",
    befunde:
      stand === "ueberfaellig"
        ? [
            {
              regel: "R-27",
              norm: normFuer(angaben.abTag),
              schwere: "hinweis",
              art: "bescheinigung_faellig",
              tage: [faelligAm],
            },
          ]
        : [],
  };
};
