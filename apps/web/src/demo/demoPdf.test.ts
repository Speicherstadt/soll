import { describe, expect, test } from "vitest";
import type { MonatAnsicht } from "../monat/typen.ts";
import { demoStundenzettelPdf } from "./demoPdf.ts";

describe("demoStundenzettelPdf", () => {
  // tdd-review finding: apps/web/src/demo/demoPdf.ts:68-79 includes absence days
  // (`z.abwesenheiten.length > 0` with `z.beginn === null`), then computes `diff = 0 - soll`
  // and prints `0:00` work/break and `-7:48` daily balance instead of `-`, contradicting
  // apps/web/src/monat/tabelle.tsx:82-85,147-168.
  test("does not print a negative daily balance or 0:00 work for an absence day without stamps", async () => {
    const ansicht: MonatAnsicht = {
      monat: "2026-11",
      nutzerId: "jonas",
      name: "Jonas Weber",
      eigen: true,
      vorbei: false,
      abschliessbarAb: null,
      offeneTage: [],
      geaenderteTage: [],
      bestaetigung: null,
      abschluss: null,
      ausgesondert: null,
      inhalt: {
        monat: "2026-11",
        summen: {
          sollMinuten: 468,
          gearbeitetMinuten: 0,
          gutschriftMinuten: 468,
          istMinuten: 468,
          saldoMinuten: 0,
        },
        nichtHinterlegt: [],
        befunde: [],
        tage: [
          {
            tag: "2026-11-02",
            modellMinuten: 468,
            stempel: [],
            abwesenheiten: [{ art: "urlaub", halb: false }],
          },
        ],
        gegeneintraege: [],
        startsalden: [],
      },
    };

    const pdf = await demoStundenzettelPdf(ansicht).text();
    expect(pdf).toContain("%PDF-1.4");
    expect(pdf).not.toContain("-7:48");
    expect(pdf).not.toMatch(/0:00\s+0:00\s+7:48/);
  });
});
