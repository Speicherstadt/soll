import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * A button whose name is longer than its text (with the person or terminal it acts on) must hold
 * its visible text, or a voice user who says what they see cannot press it (WCAG 2.5.3, axe
 * "label-content-name-mismatch"). The terminal's settings in every language (S-801).
 */
const PAARE: readonly [sichtbar: string, name: string][] = [
  ["terminal_pin_setzen", "terminal_pin_setzen_name"],
  ["terminal_qr_ausstellen", "terminal_qr_ausstellen_name"],
  ["terminal_qr_neu", "terminal_qr_neu_name"],
  ["terminal_qr_entziehen", "terminal_qr_entziehen_name"],
  ["terminal_entsperren", "terminal_entsperren_name"],
  ["terminal_entkoppeln", "terminal_entkoppeln_name"],
];

describe("the names of the terminal's buttons", () => {
  for (const sprache of ["de", "en", "tr", "pl", "uk", "ar"]) {
    it(`hold the visible text in ${sprache}`, () => {
      const texte = JSON.parse(
        readFileSync(new URL(`../../../../messages/${sprache}.json`, import.meta.url), "utf8"),
      ) as Record<string, string>;
      for (const [sichtbar, name] of PAARE)
        expect(texte[name]?.toLowerCase(), name).toContain(texte[sichtbar]?.toLowerCase());
    });
  }
});
