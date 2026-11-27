import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  // tdd-review finding: `bunx checks` (CI `check` job) fails with 5 i18n reports in
  // `apps/web/src/demo/demoPdf.ts` (lines 163-165 `label: "SOLL"|"IST"|"SALDO"` and
  // lines 298-299 German words "mit", "Seite", "von" without `i18n-ignore`).
  test("demoPdf.ts contains no unignored label fields or German words flagged by checks i18n", () => {
    const zeilen = readFileSync(resolve(import.meta.dirname, "demoPdf.ts"), "utf-8").split("\n");
    const deutsch =
      /[äöüÄÖÜß„“]|\b(und|oder|nicht|der|die|das|den|dem|ein|eine|einen|mit|für|von|zum|zur|ist|sind|wird|kann|noch|Datei|Dateien|Ordner|Seite|Fehler|Neu|Öffnen|Speichern|Löschen|Abbrechen|Schließen)\b/;
    const treffer = zeilen
      .map((text, index) => ({ zeile: index + 1, text }))
      .filter(({ zeile, text }) => {
        const ignoriert =
          text.includes("i18n-ignore") || (zeilen[zeile - 2] ?? "").includes("i18n-ignore");
        if (ignoriert || /^\s*(\/\/|\*)/.test(text)) return false;
        const stringTeile = [...text.matchAll(/"([^"\\]|\\.)*"/g)].map((m) => m[0]);
        const hatLabel = /\blabel\s*:\s*"[^"]*"/.test(text);
        const hatDeutsch = stringTeile.some((s) => deutsch.test(s));
        return hatLabel || hatDeutsch;
      });
    expect(treffer).toEqual([]);
  });

  // tdd-review finding: `tabelleZeichnen` in apps/web/src/demo/demoPdf.ts:197 hardcodes
  // `Math.min(zeilen.length, 24)`, silently dropping days 25..31 from the PDF while the total
  // row still prints `Gesamt (26 Tage)`.
  test("renders all active days when a month has more than 24 working days", async () => {
    const tage = Array.from({ length: 26 }, (_, i) => {
      const dd = String(i + 1).padStart(2, "0");
      return {
        tag: `2026-10-${dd}`,
        modellMinuten: 480,
        stempel: [
          ["kommen", Date.parse(`2026-10-${dd}T08:00:00+02:00`)],
          ["gehen", Date.parse(`2026-10-${dd}T16:30:00+02:00`)],
        ] as [string, number][],
      };
    });
    const ansicht: MonatAnsicht = {
      monat: "2026-10",
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
        monat: "2026-10",
        summen: {
          sollMinuten: 26 * 480,
          gearbeitetMinuten: 26 * 480,
          gutschriftMinuten: 0,
          istMinuten: 26 * 480,
          saldoMinuten: 0,
        },
        nichtHinterlegt: [],
        befunde: [],
        tage: tage as MonatAnsicht["inhalt"]["tage"],
        gegeneintraege: [],
        startsalden: [],
      },
    };

    const pdf = await demoStundenzettelPdf(ansicht).text();
    expect(pdf).toContain("25.10.");
    expect(pdf).toContain("26.10.");
  });
});
