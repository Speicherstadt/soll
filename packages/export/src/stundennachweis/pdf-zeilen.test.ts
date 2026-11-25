import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfText } from "../stundenzettel/text.ts";
import { type NachweisZeile, type Stundennachweis, stundennachweisPdf } from "./pdf.ts";

const ms = (text: string) => Date.parse(text);
const HASH = "cd".repeat(32);

const buchung = (notiz: string, taetigkeit = "Montage"): NachweisZeile => ({
  tag: "2026-11-19",
  person: "Sandra Brandt",
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

/** The drawn text with its line breaks taken out: a wrapped cell reads as one again */
const ohneUmbruch = async (pdf: Uint8Array) => pdfText(pdf).replaceAll("\n", " ");

describe("Stundennachweis PDF: each row in full (BAULISTE S-605: je Zeile Tätigkeit und Notiz)", () => {
  it("prints a booking's whole note, not a cut-off one", async () => {
    const notiz = "Vorwand gesetzt, Spülkasten montiert, beide Eckventile getauscht";
    const text = await ohneUmbruch(await stundennachweisPdf(nachweis([buchung(notiz)]), HASH));
    expect(text).toContain(notiz);
    expect(text).not.toContain("…");
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
});
