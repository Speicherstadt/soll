import { describe, expect, it } from "vitest";
import { pdfText } from "../stundenzettel/text.ts";
import { type Stundennachweis, stundennachweisPdf } from "./pdf.ts";

const ms = (text: string) => Date.parse(text);

const nachweis = (name: string): Stundennachweis => ({
  nummer: 7,
  betrieb: "Weber Haustechnik",
  kunde: { name: "Elbhof", nummer: "K-1001" },
  auftrag: { name: "Bad Elbhof", nummer: "A-17" },
  von: "2026-11-19",
  bis: "2026-11-19",
  zeilen: [
    {
      tag: "2026-11-19",
      person: "Sandra Brandt",
      beginn: ms("2026-11-19T08:00:00+01:00"),
      ende: ms("2026-11-19T11:30:00+01:00"),
      minuten: 210,
      taetigkeit: "Montage",
      notiz: "",
    },
  ],
  summeMinuten: 210,
  bemerkung: "",
  unterschrift: {
    name,
    am: ms("2026-11-19T16:05:00+01:00"),
    striche: [
      [
        [10, 150],
        [120, 40],
      ],
    ],
  },
});

describe("Stundennachweis PDF: the line under the signature (S-605)", () => {
  it("prints the time of the signature also for a long name of the signer (up to 100 allowed)", async () => {
    const name =
      "Erika Elbhof-Hansen für die Wohnungsbaugenossenschaft Elbhof eG, Hausverwaltung Nord";
    const text = pdfText(await stundennachweisPdf(nachweis(name), "cd".repeat(32)));
    expect(text).toContain("am 19.11.2026 16:05");
    expect(text).toContain("Hausverwaltung Nord");
  });

  it("prints a name of 100 letters without a space in full", async () => {
    const name = "W".repeat(100);
    const text = pdfText(await stundennachweisPdf(nachweis(name), "cd".repeat(32)));
    expect(text.replaceAll("\n", "")).toContain(name);
    expect(text).toContain("am 19.11.2026 16:05");
  });
});
