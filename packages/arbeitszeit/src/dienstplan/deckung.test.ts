import { describe, expect, it } from "vitest";
import { bedarfsDeckung } from "./deckung.ts";
import { bedarf, schicht } from "./testhilfen.ts";
import { planWoche } from "./woche.ts";

const { tage } = planWoche("2026-11-23");

describe("bedarfsDeckung", () => {
  it("counts the people of the role at the site on each day of the need", () => {
    const deckung = bedarfsDeckung(
      tage,
      [bedarf(1, "14:00", "22:00", 2)],
      [
        schicht("2026-11-23", "14:00", "22:00"),
        schicht("2026-11-23", "14:00", "22:30", { nutzerId: "lea" }),
      ],
    );
    expect(deckung).toEqual([
      expect.objectContaining({
        tag: "2026-11-23",
        rolle: "Service",
        anzahl: 2,
        geplant: 2,
        fehlt: 0,
        beginn: Date.parse("2026-11-23T13:00:00Z"),
        ende: Date.parse("2026-11-23T21:00:00Z"),
      }),
    ]);
  });

  it("is covered only as far as people are there at every moment of the need", () => {
    const deckung = bedarfsDeckung(
      tage,
      [bedarf(2, "10:00", "22:00", 1), bedarf(3, "10:00", "22:00", 1)],
      [
        // two shifts after one another cover the whole day once
        schicht("2026-11-24", "07:00", "15:00"),
        schicht("2026-11-24", "14:00", "22:00", { nutzerId: "lea" }),
        // a gap from 15:00 to 16:00 leaves the need uncovered
        schicht("2026-11-25", "07:00", "15:00"),
        schicht("2026-11-25", "16:00", "22:00", { nutzerId: "lea" }),
      ],
    );
    expect(deckung.map(({ geplant, fehlt }) => ({ geplant, fehlt }))).toEqual([
      { geplant: 1, fehlt: 0 },
      { geplant: 0, fehlt: 1 },
    ]);
  });

  it("counts only the role and the site of the need, and open shifts apart", () => {
    const deckung = bedarfsDeckung(
      tage,
      [bedarf(4, "14:00", "22:00", 2)],
      [
        schicht("2026-11-26", "14:00", "22:00", { rolle: "Küche" }),
        schicht("2026-11-26", "14:00", "22:00", { standortId: "hafen" }),
        schicht("2026-11-26", "14:00", "22:00", { nutzerId: null }),
        schicht("2026-11-26", "14:00", "22:00", { nutzerId: "lea" }),
      ],
    );
    expect(deckung[0]).toMatchObject({ geplant: 1, offen: 1, fehlt: 1 });
  });

  it("counts a person planned twice at the same time once", () => {
    const deckung = bedarfsDeckung(
      tage,
      [bedarf(1, "18:00", "22:00", 2)],
      [schicht("2026-11-23", "14:00", "22:00"), schicht("2026-11-23", "18:00", "22:00")],
    );
    expect(deckung[0]).toMatchObject({ geplant: 1, fehlt: 1 });
  });

  it("covers a need over midnight with a night shift of the day before", () => {
    const deckung = bedarfsDeckung(
      tage,
      [bedarf(5, "22:00", "06:00", 1)],
      [schicht("2026-11-27", "21:00", "06:00")],
    );
    expect(deckung[0]).toMatchObject({
      tag: "2026-11-27",
      geplant: 1,
      fehlt: 0,
      ende: Date.parse("2026-11-28T05:00:00Z"),
    });
  });

  it("measures the night of the clock change on real minutes", () => {
    const maerz = planWoche("2026-03-28").tage;
    const oktober = planWoche("2026-10-24").tage;
    const nacht = (tag: string) => schicht(tag, "22:00", "06:00");
    const [m] = bedarfsDeckung(maerz, [bedarf(6, "22:00", "06:00", 1)], [nacht("2026-03-28")]);
    const [o] = bedarfsDeckung(oktober, [bedarf(6, "22:00", "06:00", 1)], [nacht("2026-10-24")]);
    expect(m && m.ende - m.beginn).toBe(7 * 3_600_000);
    expect(o && o.ende - o.beginn).toBe(9 * 3_600_000);
    expect([m?.fehlt, o?.fehlt]).toEqual([0, 0]);
    // a shift that ends at 5:00 leaves the last hour of the October night uncovered
    const kurz = schicht("2026-10-24", "22:00", "05:00");
    expect(bedarfsDeckung(oktober, [bedarf(6, "22:00", "06:00", 1)], [kurz])[0]?.fehlt).toBe(1);
  });

  it("lists the needs in the order of the week, each weekday on its own day", () => {
    const deckung = bedarfsDeckung(
      tage,
      [bedarf(7, "10:00", "15:00", 1), bedarf(1, "07:00", "15:00", 1, { rolle: "Theke" })],
      [],
    );
    expect(deckung.map(({ tag, rolle, fehlt }) => [tag, rolle, fehlt])).toEqual([
      ["2026-11-23", "Theke", 1],
      ["2026-11-29", "Service", 1],
    ]);
  });
});
