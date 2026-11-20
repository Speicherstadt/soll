import { describe, expect, it } from "vitest";
import { ZUSCHLAG_GRENZEN } from "./grenzen.ts";
import { centGerundet, gedeckelt, grundlohnJeStunde } from "./grundlohn.ts";
import { einTag, rechne, schicht } from "./testhilfen.ts";

const GRENZEN =
  ZUSCHLAG_GRENZEN["2026-1"] ??
  (() => {
    throw new Error("2026-1");
  })();

describe("Grundlohn (§ 3b Abs. 2 Satz 1 EStG, R 3b Abs. 2 LStR)", () => {
  it("H 3b LStH, Grundlohn: 1.589,28 € im Monat, 38 h je Woche – 9,61 € je Stunde (÷ 38 h × 4,35)", () => {
    const stundenlohn = grundlohnJeStunde(
      { art: "monat", cent: 158928, wochenMinuten: 38 * 60 },
      GRENZEN,
    );
    expect(centGerundet(stundenlohn)).toBe(961);
    // exact: 1.589,28 € ÷ (38 × 4,35) h, nothing rounded on the way
    expect(stundenlohn.zaehler * 38n * 435n).toBe(158928n * 100n * stundenlohn.nenner);
  });

  it("uses the exact hourly Grundlohn for the amounts: 1 h of night work at 25 % of 9,6145… € is 2,41 € paid, 2,40 € tax-free", () => {
    const tag = einTag(
      rechne(
        schicht("2026-11-11T22:00+01:00", "2026-11-11T23:00+01:00"),
        { art: "monat", cent: 158928, wochenMinuten: 38 * 60 },
        { nacht: 2500 },
      ),
    );
    expect(tag.arten.nacht).toEqual({
      gezahltCent: 241,
      steuerfreiCent: 240,
      steuerpflichtigCent: 1,
    });
  });

  it("without a regular time divides by the minutes actually worked: 603,00 € for 40 h is 15,075 € an hour", () => {
    const stundenlohn = grundlohnJeStunde(
      { art: "monat", cent: 60300, wochenMinuten: null, istMinuten: 40 * 60 },
      GRENZEN,
    );
    expect(stundenlohn.zaehler * 2n).toBe(3015n * stundenlohn.nenner);
  });

  it("caps the hourly Grundlohn at 50 € (§ 3b Abs. 2 Satz 1 EStG), and only then", () => {
    expect(gedeckelt({ zaehler: 5000n, nenner: 1n }, GRENZEN)).toEqual({
      zaehler: 5000n,
      nenner: 1n,
    });
    expect(gedeckelt({ zaehler: 5001n, nenner: 1n }, GRENZEN)).toEqual({
      zaehler: 5000n,
      nenner: 1n,
    });
    // 10.000 € a month for 40 h a week: 57,47… € an hour, capped to 50 €
    const hoch = grundlohnJeStunde(
      { art: "monat", cent: 1000000, wochenMinuten: 40 * 60 },
      GRENZEN,
    );
    expect(centGerundet(hoch)).toBe(5747);
    expect(centGerundet(gedeckelt(hoch, GRENZEN))).toBe(5000);
  });
});
