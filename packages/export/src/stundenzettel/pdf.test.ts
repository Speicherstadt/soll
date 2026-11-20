import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { druckbar } from "../pdf/schreiber.ts";
import { dauerText, monatText, tagText, uhrzeitText } from "./format.ts";
import { type Stundenzettel, stundenzettelPdf } from "./pdf.ts";
import { pdfText } from "./text.ts";

const ms = (text: string) => Date.parse(text);
const PRUEFWERT = `Nr. 42 · ${"ab".repeat(32)}`;

/** Lea, Café Elbblick, October 2026 */
const zettel = (mehr: Partial<Stundenzettel> = {}): Stundenzettel => ({
  betrieb: "Café Elbblick",
  person: "Lea Schröder",
  monat: "2026-10",
  tage: [
    {
      tag: "2026-10-06",
      beginn: ms("2026-10-06T08:00:00+02:00"),
      ende: ms("2026-10-06T18:15:00+02:00"),
      pauseMinuten: 30,
      arbeitsMinuten: 585,
      sollMinuten: 480,
      hinweise: ["Verstoß § 4 ArbZG"],
    },
    {
      tag: "2026-10-07",
      beginn: null,
      ende: null,
      pauseMinuten: 0,
      arbeitsMinuten: 0,
      sollMinuten: null,
      hinweise: [],
    },
  ],
  summen: {
    sollMinuten: 10_080,
    istMinuten: 10_288,
    saldoMinuten: 208,
    gearbeitetMinuten: 10_288,
    gutschriftMinuten: 0,
  },
  nichtHinterlegt: [],
  befunde: [{ regel: "R-04", norm: "§ 4 ArbZG", schwere: "verstoss", tage: ["2026-10-06"] }],
  gegeneintraege: [],
  bestaetigt: { name: "Lea Schröder", am: ms("2026-11-02T09:00:00+01:00") },
  abgeschlossen: { name: "Mia", am: ms("2026-11-03T10:00:00+01:00"), grund: null },
  pruefwert: PRUEFWERT,
  pruefseite: "https://soll.test/pruefen/b1",
  ...mehr,
});

describe("format", () => {
  it("writes months, days, Berlin times and durations in German", () => {
    expect(monatText("2026-03")).toBe("März 2026");
    expect(tagText("2026-10-01")).toBe("Do 01.10.");
    expect(uhrzeitText(ms("2026-10-25T00:30:00Z"))).toBe("02:30");
    expect(uhrzeitText(ms("2026-10-25T01:30:00Z"))).toBe("02:30");
    expect(dauerText(585)).toBe("9:45");
    expect(dauerText(208, true)).toBe("+3:28");
    expect(dauerText(-15, true)).toBe("-0:15");
  });
});

describe("stundenzettelPdf", () => {
  it("carries days, Soll and Ist, findings with their norm and the Prüfwert", async () => {
    const pdf = await stundenzettelPdf(zettel());
    const text = pdfText(pdf);
    expect(text).toContain("Stundenzettel Oktober 2026");
    expect(text).toContain("Lea Schröder · Café Elbblick");
    expect(text).toContain("Di 06.10.");
    expect(text).toContain("08:00");
    expect(text).toContain("18:15");
    expect(text).toContain("9:45");
    expect(text).toContain("Soll 168:00 · Ist 171:28 · Saldo +3:28");
    expect(text).toContain("Verstoß: Ruhepause · § 4 ArbZG · 06.10.2026");
    expect(text).toContain(PRUEFWERT);
    expect(text).toContain("https://soll.test/pruefen/b1");
    const doc = await PDFDocument.load(pdf);
    expect(doc.getSubject()).toBe(PRUEFWERT);
    expect(doc.getPageCount()).toBe(1);
  });

  it("is a draft without Prüfwert while the month is open", async () => {
    const text = pdfText(
      await stundenzettelPdf(zettel({ abgeschlossen: null, bestaetigt: null, pruefwert: null })),
    );
    expect(text).toContain("Entwurf: Monat noch nicht abgeschlossen");
    expect(text).toContain("Von der Person nicht bestätigt");
    expect(text).not.toContain("Nr. ");
  });

  it("says nicht hinterlegt instead of sums with a gap", async () => {
    const text = pdfText(
      await stundenzettelPdf(zettel({ summen: null, nichtHinterlegt: ["2026-10-07"] })),
    );
    expect(text).toContain("Soll und Ist: nicht hinterlegt (07.10.2026)");
  });

  it("lists counter-entries and the reason of a closing without confirmation", async () => {
    const text = pdfText(
      await stundenzettelPdf(
        zettel({
          bestaetigt: null,
          abgeschlossen: {
            name: "Mia",
            am: ms("2026-11-03T10:00:00+01:00"),
            grund: "ausgeschieden",
          },
          gegeneintraege: [{ tag: "2026-09-30", minuten: -15, grund: "Pause nachgetragen" }],
        }),
      ),
    );
    expect(text).toContain("Abgeschlossen ohne Bestätigung, Grund: ausgeschieden");
    expect(text).toContain("30.09.2026: -0:15 · Grund: Pause nachgetragen");
  });

  it("goes on over several pages and gives the same file for the same sheet", async () => {
    const tage = Array.from({ length: 80 }, (_, index) => ({
      tag: `2026-10-${String((index % 31) + 1).padStart(2, "0")}`,
      beginn: null,
      ende: null,
      pauseMinuten: 0,
      arbeitsMinuten: 0,
      sollMinuten: 0,
      hinweise: [],
    }));
    const pdf = await stundenzettelPdf(zettel({ tage }));
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(2);
    expect(Buffer.from(await stundenzettelPdf(zettel({ tage })))).toEqual(Buffer.from(pdf));
  });

  it("writes letters outside WinAnsi without accent or as ?", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    expect(druckbar(font, "Łukasz Ćwik")).toBe("?ukasz Cwik");
    expect(druckbar(font, "Олена")).toBe("?????");
    expect(druckbar(font, "Jörg § 4")).toBe("Jörg § 4");
  });
});
