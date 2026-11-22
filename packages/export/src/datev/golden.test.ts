import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { datevExport } from "./export.ts";
import { GOLDEN_FAELLE } from "./golden-faelle.ts";

/*
 * Golden files (S-308, "Fertig, wenn"): Stundenlohn, Minijob and Zuschläge, for LODAS and for Lohn
 * und Gehalt, byte for byte (Windows-1252, CR LF). A changed file is a changed export: look at the
 * difference before replacing one (the numbers are worked out in golden-faelle.ts).
 */

const golden = (name: string) =>
  new Uint8Array(readFileSync(new URL(`./golden/${name}.txt`, import.meta.url)));

describe.each(Object.entries(GOLDEN_FAELLE))("golden file %s", (name, fall) => {
  it.each(["lodas", "lug"] as const)("%s byte for byte", (ziel) => {
    const ergebnis = datevExport(fall(ziel));
    if (!ergebnis.ok) throw new Error(JSON.stringify(ergebnis.fehlend));
    expect(ergebnis.datei.bytes).toEqual(golden(`${name}.${ziel}`));
  });
});

describe("the files of the cases", () => {
  it("name the target and the month", () => {
    const lodas = datevExport(GOLDEN_FAELLE.minijob("lodas"));
    const lug = datevExport(GOLDEN_FAELLE.minijob("lug"));
    expect(lodas.ok && lodas.datei.dateiname).toBe("DATEV_LODAS_2026-11.txt");
    expect(lug.ok && lug.datei.dateiname).toBe("DATEV_LuG_2026-11.txt");
  });

  it("end every line with CR LF and hold no other line break", () => {
    const ergebnis = datevExport(GOLDEN_FAELLE.zuschlaege("lodas"));
    if (!ergebnis.ok) throw new Error("fehlend");
    const text = ergebnis.datei.text;
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
  });
});
