import type { Befund } from "../befund.ts";
import { ersterTag, type Monat, tageImMonat } from "../kalender/monat.ts";
import type { Tag } from "../kalender/tag.ts";
import { inSpanne, type Tagesspanne } from "../pruefung-mutterschutz/typen.ts";

/** A span of parental leave; in part-time with the same employer it reduces nothing */
export type Elternzeit = Tagesspanne & { teilzeit?: boolean };

/**
 * R-26: Soll proposes the reduction the business may declare (`kuerzung_vorgeschlagen`), or the
 * business declared more than one twelfth per full calendar month (`kuerzung_zu_hoch`). `tage` are
 * the first days of the full months.
 */
export type ElternzeitBefund = Befund<"kuerzung_vorgeschlagen" | "kuerzung_zu_hoch"> & {
  erlaubtZwoelftel: number;
  erklaertZwoelftel: number | null;
};

const MONATE = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

/**
 * The full calendar months of a year in parental leave (§ 17 Abs. 1 Satz 1 BEEG: „für jeden vollen
 * Kalendermonat“): every day of the month in a span without part-time work (Satz 2)
 */
export const volleElternzeitmonate = (jahr: number, elternzeit: readonly Elternzeit[]): Monat[] => {
  const ohneTeilzeit = elternzeit.filter((spanne) => spanne.teilzeit !== true);
  return MONATE.map((nummer) => `${String(jahr).padStart(4, "0")}-${nummer}`).filter((monat) =>
    tageImMonat(monat).every((tag: Tag) => inSpanne(ohneTeilzeit, tag)),
  );
};

export type ElternzeitKuerzung = {
  volleMonate: Monat[];
  /** the twelfths taken off: what the business declared, at most one per full month */
  kuerzungZwoelftel: number;
  befunde: ElternzeitBefund[];
};

const befund = (
  art: ElternzeitBefund["art"],
  monate: readonly Monat[],
  erklaert: number | null,
): ElternzeitBefund => ({
  regel: "R-26",
  norm: "§ 17 Abs. 1 Satz 1 BEEG",
  schwere: "hinweis",
  art,
  tage: monate.map(ersterTag),
  erlaubtZwoelftel: monate.length,
  erklaertZwoelftel: erklaert,
});

/**
 * The reduction of leave for parental leave (§ 17 Abs. 1 BEEG): a right of the business, not an
 * automatism (docs/regeln.md, R-26). Undeclared (`erklaert` null) nothing is taken off and Soll
 * proposes it; a declaration over one twelfth per full month counts only up to that.
 */
export const elternzeitKuerzung = (
  jahr: number,
  elternzeit: readonly Elternzeit[],
  erklaert: number | null,
): ElternzeitKuerzung => {
  const volleMonate = volleElternzeitmonate(jahr, elternzeit);
  const erlaubt = volleMonate.length;
  const befunde =
    erklaert === null
      ? erlaubt > 0
        ? [befund("kuerzung_vorgeschlagen", volleMonate, null)]
        : []
      : erklaert > erlaubt
        ? [befund("kuerzung_zu_hoch", volleMonate, erklaert)]
        : [];
  return { volleMonate, kuerzungZwoelftel: Math.min(erklaert ?? 0, erlaubt), befunde };
};
