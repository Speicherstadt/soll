/**
 * Leave in half days (CLAUDE.md, "Never": no floats). A share of leave is an exact fraction of half
 * days, `zaehler / nenner`, rounded once at the end.
 */
export type Halbtage = number;

/**
 * § 5 Abs. 2 BUrlG and § 208 Abs. 2 Satz 2 SGB IX: a fraction of a day of at least one half is
 * rounded up to a full day. A smaller fraction is not rounded down but stays owed (BAG, 26.01.1989,
 * 8 AZR 730/87); Soll keeps half days, so it becomes a half day (docs/regeln.md, R-23: 8,33 → 8,5).
 * A whole number of days stays as it is. `zaehler / nenner` are half days, never negative.
 */
export const halbtageAufgerundet = (zaehler: number, nenner: number): Halbtage => {
  // in days: zaehler / (2 × nenner); compare the remainder of a day with half a day
  const tagNenner = 2 * nenner;
  const ganze = Math.floor(zaehler / tagNenner);
  const rest = zaehler - ganze * tagNenner;
  if (rest === 0) return ganze * 2;
  return 2 * rest >= tagNenner ? (ganze + 1) * 2 : ganze * 2 + 1;
};
