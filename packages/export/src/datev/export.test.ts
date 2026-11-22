import { describe, expect, it } from "vitest";
import { type DatevExportEingabe, datevExport } from "./export.ts";
import { GOLDEN_FAELLE } from "./golden-faelle.ts";

const fehlend = (eingabe: DatevExportEingabe) => {
  const ergebnis = datevExport(eingabe);
  if (ergebnis.ok) throw new Error("expected something missing");
  return ergebnis.fehlend;
};

const mit = (
  eingabe: DatevExportEingabe,
  einstellungen: Partial<DatevExportEingabe["einstellungen"]>,
): DatevExportEingabe => ({
  ...eingabe,
  einstellungen: { ...eingabe.einstellungen, ...einstellungen },
});

describe('datevExport: nothing is guessed ("nicht hinterlegt")', () => {
  it("lists consultant and client number for LODAS, missing or of the wrong form", () => {
    const fall = mit(GOLDEN_FAELLE.minijob("lodas"), { beraterNr: null, mandantenNr: "123456" });
    expect(fehlend(fall)).toEqual([{ art: "beraternummer" }, { art: "mandantennummer" }]);
  });

  it("needs neither for Lohn und Gehalt, whose file has no header", () => {
    const fall = mit(GOLDEN_FAELLE.minijob("lug"), { beraterNr: null, mandantenNr: null });
    expect(datevExport(fall).ok).toBe(true);
  });

  it("lists every person with an item but without a personnel number of 1 to 5 digits", () => {
    const fall = mit(GOLDEN_FAELLE.stundenlohn("lodas"), {
      personalnummern: { sandra: "P-101", leon: "" },
    });
    // Leon has no item, so he needs no number
    expect(fehlend(fall)).toEqual([
      { art: "personalnummer", nutzerId: "max" },
      { art: "personalnummer", nutzerId: "sandra" },
    ]);
  });

  it("lists the wage types only of the items that occur", () => {
    const fall = mit(GOLDEN_FAELLE.stundenlohn("lodas"), {
      lohnarten: { stunden: "1000", feiertag: "10a" },
    });
    expect(fehlend(fall)).toEqual([{ art: "lohnart", posten: "feiertag" }]);
  });

  it("lists persons whose month is not closed: their numbers could still change", () => {
    const fall = { ...GOLDEN_FAELLE.minijob("lodas"), offen: ["yusuf"] };
    expect(fehlend(fall)).toEqual([{ art: "monat_offen", nutzerId: "yusuf" }]);
  });

  it("passes on what a month itself lacks, together with the rest", () => {
    const fall = GOLDEN_FAELLE.zuschlaege("lodas");
    const [tom, ...rest] = fall.monate;
    if (!tom) throw new Error("tom");
    const ohneLohn = {
      ...fall,
      einstellungen: { ...fall.einstellungen, beraterNr: null },
      monate: [{ ...tom, modelle: tom.modelle.map((m) => ({ ...m, lohnCent: null })) }, ...rest],
    };
    expect(fehlend(ohneLohn)).toEqual([
      { art: "beraternummer" },
      { art: "lohn", nutzerId: "tom", tage: ["2026-12-06", "2026-12-11", "2026-12-25"] },
    ]);
  });
});

describe("datevExport: order of the records", () => {
  it("sorts the persons by their personnel number as a number (9 before 10)", () => {
    const fall = mit(GOLDEN_FAELLE.minijob("lug"), {
      personalnummern: { olena: "10", piotr: "9" },
    });
    const ergebnis = datevExport(fall);
    if (!ergebnis.ok) throw new Error("fehlend");
    expect(ergebnis.datei.text.split("\r\n").map((zeile) => zeile.split(";")[0])).toEqual([
      "9",
      "10",
      "",
    ]);
  });
});
