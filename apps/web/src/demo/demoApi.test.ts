import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { demoAntwort } from "./demoApi.ts";

describe("demoApi", () => {
  test("returns demo business and records a clock-in", async () => {
    const betrieb = await demoAntwort<{ betriebId: string; name: string }>("/api/v1/betrieb");
    expect(betrieb.ok).toBe(true);
    if (betrieb.ok) expect(betrieb.daten.name).toBe("Weber Haustechnik");

    const stempel = await demoAntwort<{ ok: boolean }>("/api/v1/arbeitszeit/stempel", {
      method: "POST",
      body: { art: "gehen" },
    });
    expect(stempel.ok).toBe(true);
  });

  // tdd-review finding: `bunx checks` (CI `check` job) fails with:
  // `apps/web/src/demo/demoDaten.ts:137  text in the code: Bäder Elbhof, 3. OG`
  test("demoDaten.ts contains no unlocalized German umlaut strings flagged by checks i18n", () => {
    const inhalt = readFileSync(resolve(import.meta.dirname, "demoDaten.ts"), "utf-8");
    const umlautZeilen = inhalt
      .split("\n")
      .map((zeile, index) => ({ zeile: index + 1, text: zeile }))
      .filter(({ text }) => /[äöüßÄÖÜ]/.test(text));
    expect(umlautZeilen).toEqual([]);
  });
});
