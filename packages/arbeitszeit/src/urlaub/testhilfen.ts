import { modell } from "../soll/testhilfen.ts";
import { type UrlaubsEingaben, urlaubsanspruch } from "./anspruch.ts";

/*
 * Helpers for the tests of leave: 2026, a model from 2020 on, employed since 2020 unless a case says
 * otherwise
 */
export const MO_DO_8: readonly number[] = [480, 480, 480, 480, 0, 0, 0];

export const BASIS: UrlaubsEingaben = {
  jahr: 2026,
  modelle: [modell("2020-01-01")],
  beschaeftigung: { eintritt: "2020-01-01" },
};

/** Days as half days: 8,5 → 17 */
export const tage = (anzahl: number): number => anzahl * 2;

export const anspruch = (eingaben: Partial<UrlaubsEingaben> = {}) => {
  const ergebnis = urlaubsanspruch({ ...BASIS, ...eingaben });
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

/** A model from 2020 with its own leave in days */
export const mitUrlaub = (urlaubTage: number, sollMinuten?: readonly number[]) => [
  modell("2020-01-01", sollMinuten, { urlaubHalbtage: tage(urlaubTage) }),
];
