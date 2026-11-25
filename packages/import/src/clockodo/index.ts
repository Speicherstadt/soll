import type { Gelesen } from "../modell.ts";
import { ohneBom } from "../text.ts";
import { abzugLesen, istAbzug } from "./abzug-lesen.ts";
import { clockodoCsvLesen } from "./csv.ts";

/*
 * Clockodo (BAULISTE.md S-703): one tool with two ways in, the CSV backup of entries and the fetch
 * from the API, read by the same id `clockodo`, so either finds what the other took over.
 */

export {
  ABZUG_ARTEN,
  ABZUG_FELDER,
  ABZUG_FORMAT,
  type Abzug,
  type AbzugArt,
  abzugText,
} from "./abzug.ts";
export { ABWESENHEITSTYPEN } from "./bestand.ts";

export const clockodoLesen = (roh: string): Gelesen => {
  const text = ohneBom(roh);
  return istAbzug(text) ? abzugLesen(text) : clockodoCsvLesen(text);
};
