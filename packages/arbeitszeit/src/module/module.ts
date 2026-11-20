/**
 * The modules of a business and the four questions of the setup that switch them (BAULISTE.md S-303,
 * docs/plan.md "Module"). The rule is the law's: with employees, working time is on and stays on
 * (BAG, 13.09.2022, 1 ABR 22/21); without them, a business records project time only.
 */
export const MODULE = ["arbeitszeit", "dienstplan", "projektzeit", "terminal"] as const;
export type Modul = (typeof MODULE)[number];
export type Module = Record<Modul, boolean>;

/** The answers: employees, shifts or a plan, hours billed to customers, a fixed place to clock in */
export type Fragen = {
  beschaeftigte: boolean;
  schichten: boolean;
  kunden: boolean;
  stempelort: boolean;
};

export const moduleAusFragen = (fragen: Fragen): Module =>
  fragen.beschaeftigte
    ? {
        arbeitszeit: true,
        dienstplan: fragen.schichten,
        projektzeit: fragen.kunden,
        terminal: fragen.stempelort,
      }
    : { arbeitszeit: false, dienstplan: false, projektzeit: true, terminal: false };

/** The answers that lead to these modules, to show a setup again as it was left */
export const fragenAusModulen = (module: Module): Fragen => ({
  beschaeftigte: module.arbeitszeit,
  schichten: module.dienstplan,
  kunden: module.projektzeit,
  stempelort: module.terminal,
});
