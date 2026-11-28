import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ssrAttribute } from "@solidjs/web";
import { describe, expect, it } from "vitest";

const ROUTE_DIR = resolve(import.meta.dirname, "../routes");

/** Extracts the runtime value passed to `spellcheck` in JSX (`"false"` vs boolean `false`). */
const spellcheckWert = (datei: string): string | boolean | undefined => {
  const quelle = readFileSync(resolve(ROUTE_DIR, datei), "utf8");
  const stringTreffer = /\bspellcheck="([^"]*)"/.exec(quelle);
  if (stringTreffer) return stringTreffer[1];
  const exprTreffer = /\bspellcheck=\{(true|false|"[^"]*"|'[^']*')\}/.exec(quelle);
  if (!exprTreffer) return undefined;
  const raw = exprTreffer[1] ?? "";
  if (raw === "false") return false;
  if (raw === "true") return true;
  return raw.slice(1, -1);
};

describe("auth forms disable spellcheck in Solid 2.0 (#118)", () => {
  for (const datei of ["anmelden.tsx", "registrieren.tsx"] as const) {
    it(`${datei} renders spellcheck="false" instead of removing the attribute`, () => {
      // In Solid 2.0 (@solidjs/web), boolean `false` is RemoveAttribute (calls removeAttribute /
      // emits ""), which leaves HTML spellchecking enabled by default. Enumerated `spellcheck`
      // requires the string `"false"` so the DOM receives `spellcheck="false"`.
      const wert = spellcheckWert(datei);
      expect(ssrAttribute("spellcheck", wert)).toBe(' spellcheck="false"');
      expect(wert).toBe("false");
    });
  }
});
