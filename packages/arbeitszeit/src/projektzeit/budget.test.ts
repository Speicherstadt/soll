import { describe, expect, it } from "vitest";
import { betragCent, budgetStand } from "./budget.ts";

describe("budgetStand", () => {
  const budget = { budgetMinuten: 2_400, budgetCent: 400_000, warnungProzent: 80 };

  it("is in order below the threshold, a warning from it, used up from 100 %", () => {
    const stand = (minuten: number, cent: number) =>
      budgetStand(budget, { minuten, cent }).map(({ stufe }) => stufe);
    expect(stand(0, 0)).toEqual(["ok", "ok"]);
    expect(stand(1_919, 319_999)).toEqual(["ok", "ok"]);
    // exactly 80 %: 1 920 of 2 400 minutes, 3 200 € of 4 000 €
    expect(stand(1_920, 320_000)).toEqual(["warnung", "warnung"]);
    expect(stand(2_399, 399_999)).toEqual(["warnung", "warnung"]);
    expect(stand(2_400, 400_000)).toEqual(["aufgebraucht", "aufgebraucht"]);
    expect(stand(3_000, 100)).toEqual(["aufgebraucht", "ok"]);
  });

  it("names used, budget and the rest in whole minutes and cents, a rest below zero when over", () => {
    expect(budgetStand(budget, { minuten: 2_500, cent: 100_050 })).toEqual([
      { art: "minuten", budget: 2_400, verbraucht: 2_500, rest: -100, stufe: "aufgebraucht" },
      { art: "cent", budget: 400_000, verbraucht: 100_050, rest: 299_950, stufe: "ok" },
    ]);
  });

  it("leaves out a budget that is not set, and takes the threshold of the order", () => {
    expect(
      budgetStand(
        { budgetMinuten: null, budgetCent: null, warnungProzent: 80 },
        { minuten: 9, cent: 9 },
      ),
    ).toEqual([]);
    const halb = { budgetMinuten: 600, budgetCent: null, warnungProzent: 50 };
    expect(budgetStand(halb, { minuten: 299, cent: 0 })[0]?.stufe).toBe("ok");
    expect(budgetStand(halb, { minuten: 300, cent: 0 })[0]?.stufe).toBe("warnung");
  });

  it("warns at a threshold of 100 % only when the budget is used up", () => {
    const voll = { budgetMinuten: 60, budgetCent: null, warnungProzent: 100 };
    expect(budgetStand(voll, { minuten: 59, cent: 0 })[0]?.stufe).toBe("ok");
    expect(budgetStand(voll, { minuten: 60, cent: 0 })[0]?.stufe).toBe("aufgebraucht");
  });
});

describe("betragCent", () => {
  it("rounds minutes times the hourly rate commercially to the cent", () => {
    expect(betragCent(60, 6_500)).toBe(6_500);
    expect(betragCent(90, 6_500)).toBe(9_750);
    // 1 min at 65,00 €: 108,33… ct → 108; 7 min at 0,10 €/h: 1,1666… ct → 1
    expect(betragCent(1, 6_500)).toBe(108);
    // 1 min at 0,30 €/h is exactly half a cent: up
    expect(betragCent(1, 30)).toBe(1);
    expect(betragCent(1, 29)).toBe(0);
    expect(betragCent(0, 6_500)).toBe(0);
  });

  it("stays exact for large values (no floats)", () => {
    expect(betragCent(1_440 * 366, 99_999)).toBe((1_440 * 366 * 99_999) / 60);
  });
});
