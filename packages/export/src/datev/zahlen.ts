/*
 * Numbers and days as the DATEV ASCII import reads them, from whole minutes and cents only: no
 * floats (CLAUDE.md, "Never"). The decimal comma and the date format are declared in the header of
 * the LODAS file (`Zahlenkomma=,`, `Datumsformat=TT.MM.JJJJ`) and set once in the import assistant of
 * Lohn und Gehalt (docs/datev.md, "Quellen").
 */

const ganz = (zahl: number, name: string): void => {
  if (!Number.isSafeInteger(zahl) || zahl < 0) throw new Error(`${name}: ${zahl}`);
};

/** Two places after the comma: 1234 → "12,34" */
const mitKomma = (hundertstel: number): string =>
  `${Math.floor(hundertstel / 100)},${String(hundertstel % 100).padStart(2, "0")}`;

/**
 * Decimal hours with two places. A minute is 1/60 hour, which two places cannot hold, so the
 * hundredths are rounded up: never to the person's disadvantage (CLAUDE.md, "Never"). Rounded once
 * per item of the month, not per day.
 */
export const stundenText = (minuten: number): string => {
  ganz(minuten, "minuten");
  // ceil(minuten × 100 / 60) = ceil(minuten × 5 / 3), in whole numbers
  return mitKomma(Math.floor((minuten * 5 + 2) / 3));
};

/** Euros with two places, without thousands separators */
export const betragText = (cent: number): string => {
  ganz(cent, "cent");
  return mitKomma(cent);
};

/** A calendar day (`YYYY-MM-DD`) as TT.MM.JJJJ */
export const datumText = (tag: string): string => {
  const [jahr, monat, tagImMonat] = tag.split("-");
  return `${tagImMonat}.${monat}.${jahr}`;
};
