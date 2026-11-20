import { describe, expect, it } from "vitest";
import { centAus, dauerText, euroText, minutenAus, slugAus, verteilen } from "./werte.ts";

describe("centAus", () => {
  it("reads euros as written in German, with or without thousands and cents", () => {
    expect(centAus("3.200,50")).toBe(320_050);
    expect(centAus("3200")).toBe(320_000);
    expect(centAus("3.200")).toBe(320_000);
    expect(centAus("13,9")).toBe(1390);
    expect(centAus(" 13,90 € ")).toBe(1390);
  });

  it("also reads a decimal point, as English keyboards write it", () => {
    expect(centAus("13.90")).toBe(1390);
    expect(centAus("13.5")).toBe(1350);
  });

  it("refuses what is no amount: no guessing, no third decimal, no sign", () => {
    for (const text of ["", "abc", "13,905", "-5", "1,234.56", "3.20.0", "1e3"])
      expect(centAus(text), text).toBeNull();
  });

  it("never computes with fractions: 0,29 € are 29 cents, not 28.999…", () => {
    expect(centAus("0,29")).toBe(29);
    expect(centAus("1.000.000,07")).toBe(100_000_007);
  });
});

describe("minutenAus", () => {
  it("reads hours, or hours and minutes, as whole minutes", () => {
    expect(minutenAus("40")).toBe(2400);
    expect(minutenAus("19:30")).toBe(1170);
    expect(minutenAus(" 0:45 ")).toBe(45);
  });

  it("reads decimal hours as contracts write them (38,5 h in TVöD), when they are whole minutes", () => {
    expect(minutenAus("38,5")).toBe(2310);
    expect(minutenAus("38.5")).toBe(2310);
    expect(minutenAus("7,75")).toBe(465);
    expect(minutenAus("39,1")).toBe(2346);
  });

  it("refuses decimals that are no whole minutes, minutes over 59 and more than a week", () => {
    for (const text of ["7,33", "7,333", "7:60", "169", "168,5", "", "x", ",5"])
      expect(minutenAus(text), text).toBeNull();
  });
});

describe("verteilen", () => {
  it("spreads the weekly minutes over the chosen days, the remainder on the first days", () => {
    const moBisFr = [true, true, true, true, true, false, false];
    expect(verteilen(2400, moBisFr)).toEqual([480, 480, 480, 480, 480, 0, 0]);
    expect(verteilen(1171, moBisFr)).toEqual([235, 234, 234, 234, 234, 0, 0]);
    expect(verteilen(600, [false, false, true, false, false, true, false])).toEqual([
      0, 0, 300, 0, 0, 300, 0,
    ]);
  });

  it("gives nothing to a week without days", () => {
    expect(verteilen(600, [false, false, false, false, false, false, false])).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
  });
});

describe("texts", () => {
  it("writes durations as 7:30, never as a decimal (DESIGN.md)", () => {
    expect(dauerText(2400)).toBe("40:00");
    expect(dauerText(1170)).toBe("19:30");
    expect(dauerText(5)).toBe("0:05");
  });

  it("writes cents as euros of the language", () => {
    expect(euroText(320_050, "de")).toBe("3.200,50 €");
    expect(euroText(1390, "en")).toBe("€13.90");
  });
});

describe("slugAus", () => {
  it("makes a short name for Better Auth from the business name", () => {
    expect(slugAus("Café Elbblick", "x7k2")).toBe("cafe-elbblick-x7k2");
    expect(slugAus("Weber Haustechnik GmbH & Co. KG", "ab12")).toBe(
      "weber-haustechnik-gmbh-co-kg-ab12",
    );
    expect(slugAus("Bäckerei Größe", "q")).toBe("baeckerei-groesse-q");
    expect(slugAus("مقهى", "z9")).toBe("betrieb-z9");
    expect(slugAus("Crêperie", "z9")).toBe("creperie-z9");
  });
});
