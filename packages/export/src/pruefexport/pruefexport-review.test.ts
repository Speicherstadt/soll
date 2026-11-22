import { describe, expect, it } from "vitest";
import { pdfText } from "../stundenzettel/text.ts";
import { pruefexportPdf } from "./pdf.ts";
import type { Pruefexport } from "./typen.ts";

const ms = (text: string) => Date.parse(text);

describe("pruefexportPdf (review of S-309)", () => {
  it("shows every finding of a day with several, as the CSV does", async () => {
    const daten: Pruefexport = {
      betrieb: "Weber Haustechnik",
      von: "2026-10-01",
      bis: "2026-10-31",
      erstelltAm: ms("2026-11-20T09:00:00+01:00"),
      pruefseite: "https://soll.test/pruefen?betrieb=b1",
      personen: [
        {
          name: "Sandra",
          tage: [
            {
              tag: "2026-10-06",
              beginn: ms("2026-10-06T06:00:00+02:00"),
              ende: ms("2026-10-06T18:00:00+02:00"),
              pauseMinuten: 0,
              arbeitsMinuten: 720,
              erfasstAm: ms("2026-10-06T18:00:00+02:00"),
              aenderungen: [],
              befunde: [
                { regel: "R-02", norm: "§ 3 ArbZG", schwere: "verstoss" },
                { regel: "R-04", norm: "§ 4 ArbZG", schwere: "verstoss" },
                { regel: "R-05", norm: "§ 5 Abs. 1 ArbZG", schwere: "verstoss" },
              ],
              gegeneintraege: [],
            },
          ],
          monate: [{ monat: "2026-10", pruefwert: null, abgeschlossenAm: null }],
        },
      ],
    };
    const text = pdfText(await pruefexportPdf(daten));
    for (const norm of ["§ 3 ArbZG", "§ 4 ArbZG", "§ 5 Abs. 1 ArbZG"]) expect(text).toContain(norm);
  });
});
