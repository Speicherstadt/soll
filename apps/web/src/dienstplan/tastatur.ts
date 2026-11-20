/** A cell of the week grid: the row of a person, the column of a day */
export type Zelle = { zeile: number; spalte: number };

const begrenzt = (wert: number, anzahl: number) => Math.min(Math.max(wert, 0), anzahl - 1);

/**
 * Where the target of a shift picked up with the keyboard goes for a key (S-501, drag and drop
 * without a mouse): up and down between people, left and right between days (mirrored in
 * right-to-left text, so "next day" follows the reading order), Home and End to Monday and Sunday.
 * It stops at the edges instead of wrapping, so a person never lands on the wrong week's day.
 */
export const zielNach = (
  taste: string,
  ziel: Zelle,
  zeilen: number,
  spalten: number,
  rtl = false,
): Zelle | undefined => {
  const vor = rtl ? "ArrowLeft" : "ArrowRight";
  const zurueck = rtl ? "ArrowRight" : "ArrowLeft";
  const schritte: Record<string, Zelle> = {
    ArrowDown: { zeile: ziel.zeile + 1, spalte: ziel.spalte },
    ArrowUp: { zeile: ziel.zeile - 1, spalte: ziel.spalte },
    [vor]: { zeile: ziel.zeile, spalte: ziel.spalte + 1 },
    [zurueck]: { zeile: ziel.zeile, spalte: ziel.spalte - 1 },
    Home: { zeile: ziel.zeile, spalte: 0 },
    End: { zeile: ziel.zeile, spalte: spalten - 1 },
  };
  const neu = schritte[taste];
  return neu && { zeile: begrenzt(neu.zeile, zeilen), spalte: begrenzt(neu.spalte, spalten) };
};
