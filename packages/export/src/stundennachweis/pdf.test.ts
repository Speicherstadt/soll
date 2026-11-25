import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfInhalt, pdfText } from "../stundenzettel/text.ts";
import { type Stundennachweis, stundennachweisPdf } from "./pdf.ts";

const ms = (text: string) => Date.parse(text);
const HASH = "cd".repeat(32);

/** Weber Haustechnik, Bad Elbhof, Sandra and Max on 19 and 20 November 2026 */
const nachweis = (mehr: Partial<Stundennachweis> = {}): Stundennachweis => ({
  nummer: 7,
  betrieb: "Weber Haustechnik",
  kunde: { name: "Elbhof", nummer: "K-1001" },
  auftrag: { name: "Bad Elbhof", nummer: "A-17" },
  von: "2026-11-19",
  bis: "2026-11-20",
  zeilen: [
    {
      tag: "2026-11-19",
      person: "Sandra Brandt",
      beginn: ms("2026-11-19T08:00:00+01:00"),
      ende: ms("2026-11-19T11:30:00+01:00"),
      minuten: 210,
      taetigkeit: "Montage",
      notiz: "Vorwand gesetzt",
    },
    {
      tag: "2026-11-20",
      person: "Max Ohm",
      beginn: ms("2026-11-20T07:15:00+01:00"),
      ende: ms("2026-11-20T08:00:00+01:00"),
      minuten: 45,
      taetigkeit: "Fahrt",
      notiz: "",
    },
  ],
  summeMinuten: 255,
  bemerkung: "Material: 2 Eckventile, 1 Spülkasten",
  unterschrift: {
    name: "Erika Elbhof",
    am: ms("2026-11-20T16:05:00+01:00"),
    striche: [
      [
        [10, 150],
        [120, 40],
        [240, 160],
      ],
    ],
  },
  ...mehr,
});

describe("stundennachweisPdf", () => {
  it("writes the report: number, customer, order, each booking, the sum, the remark", async () => {
    const text = pdfText(await stundennachweisPdf(nachweis(), HASH));
    expect(text).toContain("Stundennachweis Nr. 7");
    expect(text).toContain("Weber Haustechnik");
    expect(text).toContain("Elbhof · K-1001");
    expect(text).toContain("Bad Elbhof · A-17");
    expect(text).toContain("19.11.2026 bis 20.11.2026");
    expect(text).toContain("Do 19.11.");
    expect(text).toContain("Sandra Brandt");
    // the dash is WinAnsi 0x96, which the test reads as Latin-1
    expect(text).toMatch(/08:00.11:30/);
    expect(text).toContain("3:30");
    expect(text).toContain("Vorwand gesetzt");
    expect(text).toMatch(/07:15.08:00/);
    expect(text).toContain("Summe 4:15");
    expect(text).toContain("Material: 2 Eckventile, 1 Spülkasten");
  });

  it("names who signed and when, and the SHA-256 of its content", async () => {
    const text = pdfText(await stundennachweisPdf(nachweis(), HASH));
    expect(text).toContain("Unterschrieben von Erika Elbhof am 20.11.2026 16:05");
    expect(text).toContain(`SHA-256 des Inhalts: ${HASH}`);
  });

  it("draws the signature as lines", async () => {
    const inhalt = pdfInhalt(await stundennachweisPdf(nachweis(), HASH));
    // the stroke: a move to its first point, lines to the others, stroked
    expect(inhalt).toMatch(/ m\n[^\n]* l\n[^\n]* l\n/);
    expect(inhalt).toMatch(/\nS\n/);
  });

  it("gives the same file for the same content", async () => {
    const eins = await stundennachweisPdf(nachweis(), HASH);
    const zwei = await stundennachweisPdf(nachweis(), HASH);
    expect(Buffer.from(eins).equals(Buffer.from(zwei))).toBe(true);
    const anders = await stundennachweisPdf(nachweis({ bemerkung: "" }), HASH);
    expect(Buffer.from(eins).equals(Buffer.from(anders))).toBe(false);
  });

  it("leaves the remark out when there is none and goes on to a second page for many bookings", async () => {
    const zeile = nachweis().zeilen[0] as Stundennachweis["zeilen"][number];
    const viele = Array.from({ length: 80 }, () => zeile);
    const pdf = await stundennachweisPdf(nachweis({ bemerkung: "", zeilen: viele }), HASH);
    const text = pdfText(pdf);
    expect(text).not.toContain("Bemerkung");
    expect(text).toContain("Unterschrieben von Erika Elbhof");
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(2);
  });
});
