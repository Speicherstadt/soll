/**
 * Minutes of a budget written as whole hours ("40") or hours and minutes ("12:30"); null for an
 * entry that is none. Whole numbers only (CLAUDE.md, "Never"). Kept apart from the texts of
 * Paraglide, which a build replaces with virtual modules that a test outside Vite cannot load.
 */
export const budgetMinutenAus = (text: string): number | null => {
  const teile = /^(\d{1,6})(?::([0-5]\d))?$/.exec(text.trim());
  if (!teile) return null;
  const minuten = Number(teile[1]) * 60 + Number(teile[2] ?? "0");
  return minuten > 0 ? minuten : null;
};
