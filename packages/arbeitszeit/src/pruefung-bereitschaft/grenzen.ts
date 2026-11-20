import { regelversionAm } from "../jahreswerte/jahreswerte.ts";
import type { Tag } from "../kalender/tag.ts";
import type { Branche } from "../pruefung/grenzen.ts";

/** The limits of R-11 and R-12 in whole minutes (docs/regeln.md, §§ 2, 5, 7 ArbZG) */
export type BereitschaftGrenzen = {
  /**
   * R-12, EuGH C-518/15 (Matzak): Rufbereitschaft with a reaction time under this many minutes counts
   * fully as working time. The judgment names no number (Matzak had 8 minutes); 30 minutes is a
   * careful limit of Soll and marked as such in docs/regeln.md.
   */
  reaktionszeitAb: number;
  /** § 5 Abs. 3: „in Krankenhäusern und anderen Einrichtungen zur Behandlung, Pflege und Betreuung“ … */
  einsatzAusgleich: readonly Branche[];
  /** … call-outs „die nicht mehr als die Hälfte der Ruhezeit betragen“: half of 11 hours */
  einsatzAusgleichHoechstens: number;
  /** § 7 Abs. 9: „über zwölf Stunden hinaus verlängert“ … */
  tarifUeber: number;
  /** … „im unmittelbaren Anschluss … eine Ruhezeit von mindestens elf Stunden“ */
  tarifRuhezeit: number;
};

/**
 * The limits per rule version (docs/plan.md, Entscheidungen, "Regeln"). Text of §§ 5, 7 ArbZG on
 * gesetze-im-internet.de/arbzg/, as of 20.11.2026.
 */
export const BEREITSCHAFT_GRENZEN: Readonly<Record<string, BereitschaftGrenzen>> = {
  "2026-1": {
    reaktionszeitAb: 30,
    einsatzAusgleich: ["krankenhaus_pflege"],
    einsatzAusgleichHoechstens: (11 * 60) / 2,
    tarifUeber: 12 * 60,
    tarifRuhezeit: 11 * 60,
  },
};

/** The limits in force on a day; null before the first rule version ("nicht hinterlegt") */
export const bereitschaftGrenzenAm = (tag: Tag): BereitschaftGrenzen | null => {
  const version = regelversionAm(tag);
  return version.ok ? (BEREITSCHAFT_GRENZEN[version.wert] ?? null) : null;
};
