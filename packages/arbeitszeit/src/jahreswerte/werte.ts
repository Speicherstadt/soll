import type { Tag } from "../kalender/tag.ts";

/**
 * Yearly values with their period of validity (BAULISTE.md S-104). `von` and `bis` are Berlin
 * calendar days, both included; `bis: null` only where the law has no end date (rule versions). An
 * amount ends with its year, so a year without an entry is "nicht hinterlegt" and never inherits the
 * value of the year before (CLAUDE.md, "Never"). Each value names its source; law before secondary
 * sources (CLAUDE.md, "Reference implementations and sources").
 */
export type Gueltig<T> = { von: Tag; bis: Tag | null; wert: T; quelle: string };

const GII = "https://www.gesetze-im-internet.de";

/** Statutory minimum wage in cents per hour (§ 1 Abs. 2 MiLoG and the adjustment ordinances) */
export const MINDESTLOHN: readonly Gueltig<number>[] = [
  {
    von: "2024-01-01",
    bis: "2024-12-31",
    wert: 1241,
    quelle: `Vierte Mindestlohnanpassungsverordnung (MiLoV4) vom 24.11.2023, § 1 Nr. 1: 12,41 € ab 1.1.2024 (${GII}/milov4/)`,
  },
  {
    von: "2025-01-01",
    bis: "2025-12-31",
    wert: 1282,
    quelle: `Vierte Mindestlohnanpassungsverordnung (MiLoV4) vom 24.11.2023, § 1 Nr. 2: 12,82 € ab 1.1.2025 (${GII}/milov4/)`,
  },
  {
    von: "2026-01-01",
    bis: "2026-12-31",
    wert: 1390,
    quelle: `Fünfte Mindestlohnanpassungsverordnung (MiLoV5) vom 5.11.2025, BGBl. 2025 I Nr. 268, § 1 Nr. 1: 13,90 € ab 1.1.2026 (${GII}/milov5/)`,
  },
  {
    von: "2027-01-01",
    bis: "2027-12-31",
    wert: 1460,
    quelle: `Fünfte Mindestlohnanpassungsverordnung (MiLoV5) vom 5.11.2025, BGBl. 2025 I Nr. 268, § 1 Nr. 2: 14,60 € ab 1.1.2027 (${GII}/milov5/)`,
  },
];

const SGB_IV_8 = `§ 8 Abs. 1a SGB IV: Mindestlohn × 130 ÷ 3, auf volle Euro aufgerundet (${GII}/sgb_4/__8.html)`;

/** Mini-job limit (Geringfügigkeitsgrenze) in cents per month, derived from the minimum wage */
export const MINIJOB_GRENZE: readonly Gueltig<number>[] = [
  {
    von: "2024-01-01",
    bis: "2024-12-31",
    wert: 53800,
    quelle: `${SGB_IV_8}: 12,41 € → 537,77 € → 538 €`,
  },
  {
    von: "2025-01-01",
    bis: "2025-12-31",
    wert: 55600,
    quelle: `${SGB_IV_8}: 12,82 € → 555,53 € → 556 €`,
  },
  {
    von: "2026-01-01",
    bis: "2026-12-31",
    wert: 60300,
    quelle: `${SGB_IV_8}: 13,90 € → 602,33 € → 603 €; bekannt gemacht vom BMAS, BAnz AT 20.11.2025 B1`,
  },
  {
    von: "2027-01-01",
    bis: "2027-12-31",
    wert: 63300,
    quelle: `${SGB_IV_8}: 14,60 € → 632,67 € → 633 €`,
  },
];

/** The version of docs/regeln.md that applies to a working day */
export const REGELVERSIONEN: readonly Gueltig<string>[] = [
  {
    von: "2026-01-01",
    bis: null,
    wert: "2026-1",
    quelle:
      "docs/regeln.md, Regelversion 2026-1: Gesetzestexte auf gesetze-im-internet.de, Stand 20.11.2026",
  },
];

export type Kinderkrankentage = {
  jeKind: number;
  jeKindAlleinerziehend: number;
  hoechstens: number;
  hoechstensAlleinerziehend: number;
};

/** Days of sickness benefit for a sick child per calendar year (§ 45 SGB V, R-28) */
export const KINDERKRANKENTAGE: readonly {
  jahr: number;
  wert: Kinderkrankentage;
  quelle: string;
}[] = [
  {
    jahr: 2026,
    wert: { jeKind: 15, jeKindAlleinerziehend: 30, hoechstens: 35, hoechstensAlleinerziehend: 70 },
    quelle: `§ 45 Abs. 2a Satz 1 SGB V für das Jahr 2026 (${GII}/sgb_5/__45.html)`,
  },
  {
    jahr: 2027,
    wert: { jeKind: 10, jeKindAlleinerziehend: 20, hoechstens: 25, hoechstensAlleinerziehend: 50 },
    quelle: `§ 45 Abs. 2 Satz 1 und 2 SGB V, nach dem Ende von Abs. 2a (${GII}/sgb_5/__45.html)`,
  },
];
