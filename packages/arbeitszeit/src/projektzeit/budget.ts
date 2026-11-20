/**
 * The budget of an order in whole minutes and whole cents (BAULISTE.md S-601): a warning from the
 * order's threshold in percent, "aufgebraucht" from 100 %. Compared in whole numbers
 * (verbraucht × 100 ≥ budget × Prozent), no fractions (CLAUDE.md, "Never").
 */

export type Budget = {
  budgetMinuten: number | null;
  budgetCent: number | null;
  /** The threshold of the warning, whole percent from 1 to 100 */
  warnungProzent: number;
};

export type BudgetStufe = "ok" | "warnung" | "aufgebraucht";

export type BudgetZeile = {
  art: "minuten" | "cent";
  budget: number;
  verbraucht: number;
  /** Below zero once the budget is overrun */
  rest: number;
  stufe: BudgetStufe;
};

const stufe = (budget: number, verbraucht: number, warnungProzent: number): BudgetStufe =>
  verbraucht >= budget
    ? "aufgebraucht"
    : verbraucht * 100 >= budget * warnungProzent
      ? "warnung"
      : "ok";

const zeile = (art: BudgetZeile["art"], budget: number, verbraucht: number, prozent: number) => ({
  art,
  budget,
  verbraucht,
  rest: budget - verbraucht,
  stufe: stufe(budget, verbraucht, prozent),
});

/** One line per budget that is set: minutes first, then cents */
export const budgetStand = (
  budget: Budget,
  verbraucht: { minuten: number; cent: number },
): BudgetZeile[] => [
  ...(budget.budgetMinuten === null
    ? []
    : [zeile("minuten", budget.budgetMinuten, verbraucht.minuten, budget.warnungProzent)]),
  ...(budget.budgetCent === null
    ? []
    : [zeile("cent", budget.budgetCent, verbraucht.cent, budget.warnungProzent)]),
];

/**
 * The amount of whole minutes at an hourly rate in cents, rounded commercially to the cent (half a
 * cent up): (minutes × rate + 30) div 60, in integers
 */
export const betragCent = (minuten: number, centProStunde: number): number =>
  Math.floor((minuten * centProStunde + 30) / 60);
