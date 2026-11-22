import { m } from "../paraglide/messages.js";

const FEHLER: Record<string, () => string> = {
  abweichung: m.nachweis_fehler_abweichung,
  leer: m.nachweis_fehler_leer,
  netz: m.fehler_netz,
};

/** The text of a refusal of a signature */
export const nachweisFehler = (fehler: string): string => (FEHLER[fehler] ?? m.fehler_speichern)();
