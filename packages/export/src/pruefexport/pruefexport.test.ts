import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfText } from "../stundenzettel/text.ts";
import { beispiel } from "./beispiel.ts";
import { pruefexportCsv } from "./csv.ts";
import { pruefexportPdf } from "./pdf.ts";
import type { PruefPerson } from "./typen.ts";

/**
 * Golden files: the expected export lies next to the test. `SOLL_GOLDEN=schreiben` writes it anew
 * after an intended change; the diff then shows in the pull request.
 */
const golden = (name: string, ist: string) => {
  const pfad = new URL(`./golden/${name}`, import.meta.url);
  if (process.env.SOLL_GOLDEN === "schreiben") writeFileSync(pfad, ist);
  expect(existsSync(pfad), `golden/${name} fehlt`).toBe(true);
  expect(ist).toBe(readFileSync(pfad, "utf8"));
};

describe("pruefexportCsv", () => {
  it("matches the golden file", () => {
    golden("pruefexport.csv", pruefexportCsv(beispiel));
  });

  it("has a row per person and day, with the columns an authority needs", () => {
    const zeilen = pruefexportCsv(beispiel).slice(1).split("\r\n");
    expect(zeilen[0]).toBe(
      "Person;Datum;Beginn;Ende;Pausen (Minuten);Dauer (Minuten);Erfasst am;Änderungen;Gegeneinträge;Befunde;Monat abgeschlossen;Prüfwert",
    );
    expect(zeilen[1]).toContain("Lea Schröder;06.10.2026;08:00;18:15;30;585;07.10.2026 09:12;");
    expect(zeilen[2]).toContain(";31.10.2026;20:00;01.11.2026 02:00;0;360;");
    expect(zeilen[4]).toContain(
      ';"nachgetragen am 18.11.2026 08:00 von Олена Коваль: Kommen 10:00, Grund: =Zettel; Mia";',
    );
    expect(zeilen).toHaveLength(6);
    expect(zeilen[5]).toBe("");
  });

  it("gives the Prüfwert of the closed month on each of its days, nothing for an open one", () => {
    const zeilen = pruefexportCsv(beispiel).split("\r\n");
    expect(zeilen[1]).toMatch(/;03\.11\.2026 10:00;Nr\. 42 · (ab){32}$/);
    expect(zeilen[3]).toMatch(/;;$/);
  });

  it("guards a name a spreadsheet would read as a formula", () => {
    const [lea] = beispiel.personen;
    const boese = { ...beispiel, personen: [{ ...(lea as PruefPerson), name: "=HYPERLINK(1)" }] };
    expect(pruefexportCsv(boese).split("\r\n")[1]).toMatch(/^'=HYPERLINK\(1\);06\.10\.2026;/);
  });

  it("is only the header for a period without days", () => {
    const leer = { ...beispiel, personen: [{ name: "Tom", tage: [], monate: [] }] };
    expect(pruefexportCsv(leer).split("\r\n")).toHaveLength(2);
  });
});

describe("pruefexportPdf", () => {
  it("matches the golden file in its text", async () => {
    golden("pruefexport-pdf.txt", pdfText(await pruefexportPdf(beispiel)));
  });

  it("starts each person on a page of their own, landscape, and is the same file each time", async () => {
    const pdf = await pruefexportPdf(beispiel);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(2);
    const seite = doc.getPage(0);
    expect(seite.getWidth()).toBeGreaterThan(seite.getHeight());
    expect(doc.getTitle()).toBe("Prüfexport 01.10.2026 bis 30.11.2026 · Café Elbblick");
    expect(Buffer.from(await pruefexportPdf(beispiel))).toEqual(Buffer.from(pdf));
  });

  it("carries the same content as the CSV", async () => {
    const text = pdfText(await pruefexportPdf(beispiel));
    for (const teil of [
      "Lea Schröder",
      "Di 06.10.2026",
      "08:00",
      "18:15",
      "9:45",
      "07.10.2026 09:12",
      "Verstoß: Ruhepause · § 4 ArbZG",
      "geändert am 07.10.2026 09:12 von Mia Hansen: vorher Gehen 17:00, jetzt Gehen 18:15, Grund: Inventur, Gehen vergessen",
      "Gegeneintrag -0:15 am 04.11.2026 11:00 von Mia Hansen, Grund: Pause nicht gestempelt",
      `Oktober 2026: abgeschlossen am 03.11.2026 10:00, Prüfwert Nr. 42 · ${"ab".repeat(32)}`,
      "November 2026: nicht abgeschlossen",
      "02:00 (01.11.)",
      "????? ??????",
      "https://soll.test/pruefen?betrieb=b1",
    ])
      expect(text).toContain(teil);
  });
});
