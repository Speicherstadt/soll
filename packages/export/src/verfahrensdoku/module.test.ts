import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { elbblick, solo, weber } from "./beispiel.ts";
import { verfahrensdokuAus } from "./dokument.ts";
import { alsMarkdown, markdownText } from "./markdown.ts";
import type { DokuStandDaten, Module } from "./typen.ts";

/**
 * Review of S-902: a module that is off is named as off, and none of its procedures is described
 * in any section; entity references stay as the business wrote them.
 */

const TAG = "2026-11-25";
const AUS: Module = { arbeitszeit: false, dienstplan: false, projektzeit: false, terminal: false };
const md = (stand: DokuStandDaten, module: Partial<Module>) =>
  alsMarkdown(verfahrensdokuAus({ ...stand, module: { ...AUS, ...module } }, TAG));
/** Weber without its own section, whose text (paper time sheets) is the business's, not Soll's */
const ohneEigene: DokuStandDaten = { ...weber, angaben: { ...weber.angaben, eigene: [] } };

const golden = (name: string, ist: string) => {
  const pfad = new URL(`./golden/${name}`, import.meta.url);
  if (process.env.SOLL_GOLDEN === "schreiben") writeFileSync(pfad, ist);
  expect(existsSync(pfad), `golden/${name} fehlt`).toBe(true);
  expect(ist).toBe(readFileSync(pfad, "utf8"));
};

describe("modules switched off", () => {
  it("matches the golden Markdown of a freelancer with project time only", () => {
    golden("solo.md", alsMarkdown(verfahrensdokuAus(solo, TAG)));
  });

  it("leaves out every procedure of working time when it is off", () => {
    const text = md(ohneEigene, { projektzeit: true });
    expect(text).toContain("Das Modul Arbeitszeit ist ausgeschaltet");
    for (const verfahren of [
      "Vier Augen beim Monat",
      "Stempelungen lassen sich bis zum Monatsabschluss",
      "Jeder Tag wird gegen das Arbeitszeitgesetz",
      "Stundenzettel",
      "Aufbewahrt wird je abgeschlossenem Monat",
      "Monatsabschluss",
      "Stempelung",
      "Prüfexport",
      "DATEV",
      "Schicht",
    ])
      expect(text, verfahren).not.toContain(verfahren);
  });

  it("names the terminal only where the module is on", () => {
    const ohne = md(elbblick, { arbeitszeit: true });
    expect(ohne).toContain("Das Modul Terminal ist ausgeschaltet");
    expect(ohne).not.toMatch(/am Terminal|Terminals|Terminal „/);
    const mit = md(elbblick, { arbeitszeit: true, terminal: true });
    expect(mit).toContain("oder am Terminal");
    expect(mit).toContain("Lücken in den Nummern der Geräte und Terminals");
  });

  it("describes the shift plan and project time only where they are on", () => {
    const ohne = md(weber, { arbeitszeit: true });
    expect(ohne).not.toMatch(
      /Dienstplan: Planer|veröffentlich|Projektzeit: [AB]|Stundennachweis|Haben/,
    );
    const mit = md(weber, { arbeitszeit: true, dienstplan: true, projektzeit: true });
    expect(mit).toContain("Dienstplan: Planer legen Schichten an");
    expect(mit).toContain("Projektzeit: Buchungen auf Kunden");
    expect(mit).toContain("Haben: Abgerechnete Projektzeit");
  });

  it("keeps the counts of months closed while working time was on", () => {
    const text = md(elbblick, { projektzeit: true });
    expect(text).toContain(
      "Das Modul Arbeitszeit ist ausgeschaltet; Soll schließt keine Monate ab.",
    );
    expect(text).toContain("Aus der Zeit, in der es eingeschaltet war:");
  });
});

describe("entity references", () => {
  it("escapes them, so the text stays as the business wrote it", () => {
    // CommonMark 0.31, 2.5 "Entity and numeric character references": &amp; renders as "&"
    expect(markdownText("Weber &amp; Söhne")).toBe("Weber \\&amp; Söhne");
  });
});
