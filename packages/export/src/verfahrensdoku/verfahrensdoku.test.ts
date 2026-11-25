import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pdfText } from "../stundenzettel/text.ts";
import { ANGABE_NAMEN, ANGABEN_FELDER, LEERE_ANGABEN } from "./angaben.ts";
import { elbblick, weber } from "./beispiel.ts";
import { tagInDeutschland, verfahrensdokuAus } from "./dokument.ts";
import { alsMarkdown, markdownText } from "./markdown.ts";
import { abschnitt, verfahrensdoku } from "./modell.ts";
import { verfahrensdokuPdf } from "./pdf.ts";

/** Golden files next to the test; `SOLL_GOLDEN=schreiben` writes them anew after an intended change */
const golden = (name: string, ist: string) => {
  const pfad = new URL(`./golden/${name}`, import.meta.url);
  if (process.env.SOLL_GOLDEN === "schreiben") writeFileSync(pfad, ist);
  expect(existsSync(pfad), `golden/${name} fehlt`).toBe(true);
  expect(ist).toBe(readFileSync(pfad, "utf8"));
};

const TAG = "2026-11-25";
const titel = (doku: ReturnType<typeof verfahrensdokuAus>) => doku.abschnitte.map((a) => a.titel);

describe("verfahrensdokuAus", () => {
  it("matches the golden Markdown of Weber Haustechnik and Café Elbblick", () => {
    golden("weber.md", alsMarkdown(verfahrensdokuAus(weber, TAG)));
    golden("elbblick.md", alsMarkdown(verfahrensdokuAus(elbblick, TAG)));
  });

  it("is structured after GoBD Rz. 153 and has the internal control system", () => {
    expect(titel(verfahrensdokuAus(weber, TAG))).toEqual([
      "1. Allgemeine Beschreibung",
      "2. Anwenderdokumentation: Erfassung und Verarbeitung",
      "3. Anwenderdokumentation: Terminal",
      "4. Anwenderdokumentation: Weitergabe und Übernahme von Daten",
      "5. Technische Systemdokumentation: Audit-Kette und Prüfwert",
      "6. Technische Systemdokumentation: Programm und Datenhaltung",
      "7. Betriebsdokumentation: Zugänge und Rechte",
      "8. Betriebsdokumentation: Aufbewahrung und Aussonderung",
      "9. Betriebsdokumentation: Betrieb und Datensicherung",
      "10. Internes Kontrollsystem",
      "11. Fassungen dieser Dokumentation",
      "12. Stundenzettel auf Papier vor Soll",
    ]);
  });

  it("is complete with every statement and names each missing one as a gap", () => {
    const voll = verfahrensdokuAus(weber, TAG);
    expect(voll.vollstaendig).toBe(true);
    const leer = verfahrensdokuAus({ ...weber, angaben: LEERE_ANGABEN }, TAG);
    expect(leer.luecken).toBe(ANGABE_NAMEN.length);
    expect(leer.abschnitte.flatMap((a) => a.luecken ?? [])).toEqual(
      expect.arrayContaining(ANGABE_NAMEN.map((name) => ANGABEN_FELDER[name].luecke)),
    );
    expect(verfahrensdokuAus(elbblick, TAG).luecken).toBe(ANGABE_NAMEN.length - 2);
  });

  it("carries day, version and Prüfwert in its Stand (Rz. 154)", () => {
    const doku = verfahrensdokuAus(weber, TAG);
    expect(doku.stand).toEqual({
      datum: TAG,
      programm: "Soll",
      version: "1.0.0",
      pruefwert: weber.kette.pruefwert,
    });
    expect(alsMarkdown(doku)).toContain("Prüfwert der Audit-Kette beim Erzeugen: Nr. 4711 · 3f9a");
  });

  it("describes a switched-off module as off and leaves its procedures out", () => {
    const md = alsMarkdown(verfahrensdokuAus(weber, TAG));
    expect(md).toContain("Das Modul Terminal ist ausgeschaltet");
    expect(md).toContain("Modul Dienstplan: ausgeschaltet");
    expect(md).not.toMatch(/einmaligen Kopplungscode|Planer legen Schichten/);
    const cafe = alsMarkdown(verfahrensdokuAus(elbblick, TAG));
    expect(cafe).toContain("Terminal „Tresen“: gekoppelt, mit Schlüssel für die Warteschlange");
    expect(cafe).toContain("Terminal „Altes Tablet“: widerrufen");
    expect(cafe).not.toMatch(/Haben:|Projektzeit: Buchungen/);
  });

  it("names the Haben address but never more of the link, and DATEV only by counts", () => {
    const md = alsMarkdown(verfahrensdokuAus(weber, TAG));
    expect(md).toContain("haben.weber-haustechnik.test");
    expect(md).toContain("4 Lohnarten und 5 Personalnummern");
  });

  it("states the findings of the chain check", () => {
    expect(alsMarkdown(verfahrensdokuAus(weber, TAG))).toContain("fand keine Befunde");
    expect(alsMarkdown(verfahrensdokuAus(elbblick, TAG))).toContain("fand 2 Befunde");
    const leer = { ...elbblick, kette: { pruefwert: null, glieder: 0, befunde: 0 } };
    expect(alsMarkdown(verfahrensdokuAus(leer, TAG))).toContain("noch kein Glied");
  });

  it("numbers the business's own sections after the generated ones and skips empty ones", () => {
    const eigene = [
      { titel: "Erstes", text: "a" },
      { titel: " ", text: " " },
      { titel: "", text: "b\n\nc" },
    ];
    const doku = verfahrensdokuAus({ ...weber, angaben: { ...weber.angaben, eigene } }, TAG);
    expect(doku.abschnitte.slice(11)).toEqual([
      { titel: "12. Erstes", absaetze: ["a"] },
      { titel: "13. Ohne Titel", absaetze: ["b", "c"] },
    ]);
  });

  it("lists each saved change of the statements with its link", () => {
    expect(alsMarkdown(verfahrensdokuAus(weber, TAG))).toContain(
      "- 20\\.11.2026 16:40: Angaben gespeichert (Glied Nr. 4705)",
    );
  });

  it("escapes formatting and HTML from statements", () => {
    const md = alsMarkdown(verfahrensdokuAus(elbblick, TAG));
    expect(md).toContain("Anschrift: \\# Elbstraße 5 \\<b\\>");
    expect(md).not.toContain("<b>");
    expect(alsMarkdown(verfahrensdokuAus(weber, TAG))).toContain("Ordner \\*2026\\*");
  });
});

describe("model and Markdown copied from gobd-kern", () => {
  it("counts gaps and leaves out empty paragraphs, items and gaps", () => {
    expect(
      abschnitt("A", { absaetze: ["eins", "", "  "], liste: ["", "x"], luecken: [""] }),
    ).toEqual({
      titel: "A",
      absaetze: ["eins"],
      liste: ["x"],
    });
    const stand = { datum: TAG, programm: "Soll", version: "1", pruefwert: null };
    expect(() =>
      verfahrensdoku({ titel: "T", stand: { ...stand, datum: "25.11.2026" }, abschnitte: [] }),
    ).toThrow();
  });

  it("escapes lines that would become a list or a heading", () => {
    expect(markdownText("- keine Liste\n1. keine Nummer\n---")).toBe(
      "\\- keine Liste  \n1\\. keine Nummer  \n\\---",
    );
  });

  it("takes the day in Germany, not in UTC", () => {
    expect(tagInDeutschland(Date.UTC(2026, 11, 31, 23, 30))).toBe("2027-01-01");
  });
});

describe("verfahrensdokuPdf", () => {
  it("matches the golden text and is the same file for the same document", async () => {
    const doku = verfahrensdokuAus(weber, TAG);
    const pdf = await verfahrensdokuPdf(doku);
    golden("weber-pdf.txt", pdfText(pdf));
    expect(Buffer.from(await verfahrensdokuPdf(doku)).equals(Buffer.from(pdf))).toBe(true);
    golden("elbblick-pdf.txt", pdfText(await verfahrensdokuPdf(verfahrensdokuAus(elbblick, TAG))));
  });

  it("prints the gaps as Fehlt", async () => {
    const text = pdfText(await verfahrensdokuPdf(verfahrensdokuAus(elbblick, TAG)));
    expect(text).toContain("Fehlt: Ort der Aufbewahrung von Daten und Sicherungen");
  });
});
