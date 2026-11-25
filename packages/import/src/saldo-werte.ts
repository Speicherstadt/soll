/*
 * The balances on a cut-off date as old tools and spreadsheets write them (BAULISTE.md S-708):
 * overtime as hours and minutes with a sign (`-12:30`, `+3:05`) or as decimal hours (`7,5`, `-0.25`),
 * leave as days in steps of a half (`8`, `8,5`). Read with whole numbers only, never a float
 * (CLAUDE.md, "Never"); a value that is no whole number of minutes or half days is null, never a
 * rounded guess.
 */

/** Far beyond any real account: 100,000 hours, 10,000 days */
const MAX_STUNDEN = 100_000;
const MAX_TAGE = 10_000;

/** The sign of a value: `-`, the Unicode minus `−` or `+`, and the rest */
const vorzeichen = (text: string): { negativ: boolean; rest: string } => {
  const wert = text.trim();
  const zeichen = wert.charAt(0);
  if (zeichen === "-" || zeichen === "−") return { negativ: true, rest: wert.slice(1).trim() };
  if (zeichen === "+") return { negativ: false, rest: wert.slice(1).trim() };
  return { negativ: false, rest: wert };
};

/**
 * A decimal `ganz,bruch` as an exact fraction of `nenner`: `7,5` with 60 → 450; null when it is not
 * a whole number of them (`7,33` hours are 439,8 minutes)
 */
const dezimalIn = (text: string, nenner: number, hoechstens: number): number | null => {
  const teile = /^(\d{1,6})(?:[.,](\d{1,4}))?$/.exec(text);
  if (!teile) return null;
  const ganz = Number(teile[1]);
  if (ganz > hoechstens) return null;
  const bruch = teile[2] ?? "";
  const zehner = 10 ** bruch.length;
  const zaehler = Number(bruch === "" ? "0" : bruch) * nenner;
  if (zaehler % zehner !== 0) return null;
  return ganz * nenner + zaehler / zehner;
};

/** Overtime in whole minutes, signed: `-12:30`, `12:30`, `+0:45`, `7,5`, `-8`; empty is none */
export const saldoMinutenLesen = (text: string): number | null => {
  const { negativ, rest } = vorzeichen(text);
  if (rest === "") return null;
  const uhr = /^(\d{1,6}):(\d{2})$/.exec(rest);
  const minuten = uhr
    ? Number(uhr[2]) < 60 && Number(uhr[1]) <= MAX_STUNDEN
      ? Number(uhr[1]) * 60 + Number(uhr[2])
      : null
    : dezimalIn(rest, 60, MAX_STUNDEN);
  if (minuten === null) return null;
  return negativ && minuten !== 0 ? -minuten : minuten;
};

/** Leave in half days, never negative: `8` → 16, `8,5` → 17; `8,3` and `-1` are null */
export const urlaubHalbtageLesen = (text: string): number | null => {
  const wert = text.trim();
  return wert === "" ? null : dezimalIn(wert, 2, MAX_TAGE);
};
