/*
 * What the owner types into a change of an account (S-402): hours as `h:mm` and days with halves,
 * read into whole minutes and half days without floats (CLAUDE.md, "Never")
 */

/** A leading sign, also the typographic minus */
const vorzeichen = (text: string): { faktor: 1 | -1; rest: string } => {
  const t = text.trim();
  if (t.startsWith("-") || t.startsWith("−")) return { faktor: -1, rest: t.slice(1) };
  return { faktor: 1, rest: t.startsWith("+") ? t.slice(1) : t };
};

/** "7:30" → 450, "-1:30" → -90, "12" → 720; null for anything else */
export const minutenAus = (text: string): number | null => {
  const { faktor, rest } = vorzeichen(text);
  const treffer = /^(\d{1,5})(?::([0-5]\d))?$/.exec(rest);
  if (!treffer) return null;
  return faktor * (Number(treffer[1]) * 60 + Number(treffer[2] ?? 0));
};

/** "2,5" → 5, "-1" → -2; null for a part smaller than half a day */
export const halbtageAus = (text: string): number | null => {
  const { faktor, rest } = vorzeichen(text);
  const treffer = /^(\d{1,3})(?:[,.](0|5))?$/.exec(rest);
  if (!treffer) return null;
  return faktor * (Number(treffer[1]) * 2 + (treffer[2] === "5" ? 1 : 0));
};
