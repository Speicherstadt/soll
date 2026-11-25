import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfInhalt, pdfText } from "../stundenzettel/text.ts";
import { type NachweisZeile, type Stundennachweis, stundennachweisPdf } from "./pdf.ts";

const ms = (text: string) => Date.parse(text);
const HASH = "cd".repeat(32);

const buchung = (
  notiz: string,
  taetigkeit = "Montage",
  person = "Sandra Brandt",
): NachweisZeile => ({
  tag: "2026-11-19",
  person,
  beginn: ms("2026-11-19T08:00:00+01:00"),
  ende: ms("2026-11-19T11:30:00+01:00"),
  minuten: 210,
  taetigkeit,
  notiz,
});

const nachweis = (zeilen: NachweisZeile[]): Stundennachweis => ({
  nummer: 7,
  betrieb: "Weber Haustechnik",
  kunde: { name: "Elbhof", nummer: "K-1001" },
  auftrag: { name: "Bad Elbhof", nummer: "A-17" },
  von: "2026-11-19",
  bis: "2026-11-19",
  zeilen,
  summeMinuten: 210 * zeilen.length,
  bemerkung: "",
  unterschrift: {
    name: "Erika Elbhof",
    am: ms("2026-11-19T16:05:00+01:00"),
    striche: [
      [
        [10, 150],
        [120, 40],
      ],
    ],
  },
});

/** The height of each line of text drawn, from the text matrices (`1 0 0 1 x y Tm`) */
const hoehen = (pdf: Uint8Array) =>
  [...pdfInhalt(pdf).matchAll(/1 0 0 1 -?[\d.]+ (-?[\d.]+) Tm/g)].map((t) => Number(t[1]));

/** The drawn text with its line breaks taken out: a wrapped cell reads as one again */
const ohneUmbruch = async (pdf: Uint8Array) => pdfText(pdf).replaceAll("\n", " ");

describe("Stundennachweis PDF: each row in full (BAULISTE S-605: je Zeile Tätigkeit und Notiz)", () => {
  it("prints a booking's whole note, not a cut-off one", async () => {
    const notiz = "Vorwand gesetzt, Spülkasten montiert, beide Eckventile getauscht";
    const text = await ohneUmbruch(await stundennachweisPdf(nachweis([buchung(notiz)]), HASH));
    expect(text).toContain(notiz);
    expect(text).not.toContain("…");
  });

  it("prints each line of a note with line breaks, not a question mark for the break", async () => {
    // the API takes line breaks in a note (apps/server/src/routes/stoppuhr.ts)
    const notiz = "Zeile eins\nZeile zwei\r\nZeile drei";
    const text = pdfText(await stundennachweisPdf(nachweis([buchung(notiz)]), HASH));
    for (const teil of ["Zeile eins", "Zeile zwei", "Zeile drei"]) expect(text).toContain(teil);
    expect(text).not.toContain("?");
  });

  it("keeps a note of many lines out of the bottom margin", async () => {
    const notiz = Array.from({ length: 8 }, (_, index) => `Schritt ${index}`).join("\n");
    for (let anzahl = 1; anzahl <= 70; anzahl++) {
      const zeilen = Array.from({ length: anzahl }, () => buchung(notiz));
      const y = hoehen(await stundennachweisPdf(nachweis(zeilen), HASH));
      expect(Math.min(...y), `${anzahl} rows`).toBeGreaterThanOrEqual(40);
    }
  });

  it("prints the whole name of the activity", async () => {
    const taetigkeit = "Heizungswartung mit Abgasmessung";
    const text = await ohneUmbruch(
      await stundennachweisPdf(nachweis([buchung("", taetigkeit)]), HASH),
    );
    expect(text).toContain(taetigkeit);
  });

  it("goes on to further pages with many long rows and keeps each of them whole", async () => {
    const notiz = (nummer: number) =>
      `Nr. ${nummer}: Vorwand gesetzt, Spülkasten montiert, beide Eckventile getauscht, Abfluss geprüft und dicht`;
    const zeilen = Array.from({ length: 60 }, (_, index) =>
      buchung(notiz(index + 1), "Heizungswartung mit Abgasmessung"),
    );
    const pdf = await stundennachweisPdf(nachweis(zeilen), HASH);
    const text = await ohneUmbruch(pdf);
    for (let nummer = 1; nummer <= 60; nummer++) expect(text).toContain(notiz(nummer));
    expect(text).toContain("Unterschrieben von Erika Elbhof");
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(2);
  });

  it("continues a row taller than a page on the next page, drawing nothing below the bottom", async () => {
    // about three words a line: some 130 lines, more than two pages hold
    const person = "Sandra Brandt ".repeat(200).trim();
    const pdf = await stundennachweisPdf(nachweis([buchung("", "Montage", person)]), HASH);
    const y = hoehen(pdf);
    expect(y.length).toBeGreaterThan(0);
    // RAND of the writer: no line in the bottom margin, let alone below the page
    expect(Math.min(...y)).toBeGreaterThanOrEqual(40);
    // every word of the name is drawn; the head of the table on each new page comes in between
    const text = await ohneUmbruch(pdf);
    expect(text.match(/Sandra/g)).toHaveLength(200);
    expect(text.match(/Brandt/g)).toHaveLength(200);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(2);
  });

  it("repeats the head of the table on each page it goes on to", async () => {
    const zeilen = Array.from({ length: 80 }, () => buchung("Montage Vorwand"));
    const text = pdfText(await stundennachweisPdf(nachweis(zeilen), HASH));
    expect(text.match(/^Tätigkeit$/gm)).toHaveLength(2);
  });

  it("writes nothing into the bottom margin, whatever the number of rows", async () => {
    for (let anzahl = 1; anzahl <= 70; anzahl++) {
      const zeilen = Array.from({ length: anzahl }, () => buchung("Montage"));
      const y = hoehen(await stundennachweisPdf(nachweis(zeilen), HASH));
      expect(Math.min(...y), `${anzahl} rows`).toBeGreaterThanOrEqual(40);
    }
  });

  it("writes nothing into the bottom margin with a signer's name over several lines", async () => {
    for (let anzahl = 1; anzahl <= 70; anzahl++) {
      const zeilen = Array.from({ length: anzahl }, () => buchung("Montage"));
      const lang = nachweis(zeilen);
      lang.unterschrift.name = "W".repeat(100);
      const y = hoehen(await stundennachweisPdf(lang, HASH));
      expect(Math.min(...y), `${anzahl} rows`).toBeGreaterThanOrEqual(40);
    }
  });
});
