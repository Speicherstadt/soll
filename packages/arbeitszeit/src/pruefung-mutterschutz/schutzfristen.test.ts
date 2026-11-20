import { describe, expect, it } from "vitest";
import {
  schutzfristen,
  schutzfristNachEntbindung,
  schutzfristNachFehlgeburt,
  schutzfristVorEntbindung,
} from "./schutzfristen.ts";
import { tagAb } from "./testhilfen.ts";

/* docs/regeln.md, R-21 (cases taken literally), § 3 MuSchG */
const arbeit = (tag: string) => tagAb(tag, "8:00", 240);

describe("R-21: Schutzfristen", () => {
  it("Verstoß: Arbeit in der Woche nach der Entbindung – „Schutzfrist“", () => {
    const frist = schutzfristNachEntbindung("2026-11-02");
    if (frist === null) throw new Error("Regelversion 2026-1");
    expect(schutzfristen([arbeit("2026-11-05")], [frist])).toEqual({
      befunde: [
        {
          regel: "R-21",
          norm: "§ 3 Abs. 2 MuSchG",
          schwere: "verstoss",
          art: "schutzfrist",
          tage: ["2026-11-05"],
          schutzfrist: frist,
        },
      ],
      nichtHinterlegt: [],
    });
  });

  it("Fehlgeburt: in the 18th week, work in the 5th week after without a declaration – Verstoß", () => {
    const frist = schutzfristNachFehlgeburt("2026-10-01", 18);
    if (frist === null) throw new Error("ab der 17. Woche");
    // the 5th week after 1.10.: 29.10. to 4.11.
    expect(schutzfristen([arbeit("2026-11-02")], [frist]).befunde).toEqual([
      expect.objectContaining({ norm: "§ 3 Abs. 5 MuSchG", tage: ["2026-11-02"] }),
    ]);
  });

  it("Fehlgeburt: as before, with her express declaration – no finding", () => {
    const frist = schutzfristNachFehlgeburt("2026-10-01", 18, true);
    if (frist === null) throw new Error("ab der 17. Woche");
    expect(schutzfristen([arbeit("2026-11-02")], [frist]).befunde).toEqual([]);
  });

  it("Ende der Schutzfrist: birth Mo 2.11.2026, work Mo 28.12. Verstoß, Di 29.12. none", () => {
    const frist = schutzfristNachEntbindung("2026-11-02");
    if (frist === null) throw new Error("Regelversion 2026-1");
    expect(frist).toEqual({ art: "nach_entbindung", von: "2026-11-03", bis: "2026-12-28" });
    expect(schutzfristen([arbeit("2026-12-28")], [frist]).befunde).toHaveLength(1);
    expect(schutzfristen([arbeit("2026-12-29")], [frist]).befunde).toEqual([]);
  });

  it("knows no declaration after the birth, and an end moved under § 3 Abs. 4 is entered", () => {
    const erklaert = {
      art: "nach_entbindung" as const,
      von: "2026-11-03",
      bis: "2026-12-28",
      bereitErklaert: true,
    };
    expect(schutzfristen([arbeit("2026-11-20")], [erklaert]).befunde).toHaveLength(1);
    const verkuerzt = { art: "nach_entbindung" as const, von: "2026-11-03", bis: "2026-11-16" };
    expect(schutzfristen([arbeit("2026-11-20")], [verkuerzt]).befunde).toEqual([]);
  });

  it("before the birth: six weeks and the expected day itself, lifted by her declaration", () => {
    const frist = schutzfristVorEntbindung("2026-12-14");
    expect(frist).toEqual({ art: "vor_entbindung", von: "2026-11-02", bis: "2026-12-14" });
    if (frist === null) return;
    expect(schutzfristen([arbeit("2026-11-01"), arbeit("2026-11-02")], [frist]).befunde).toEqual([
      expect.objectContaining({ norm: "§ 3 Abs. 1 MuSchG", tage: ["2026-11-02"] }),
    ]);
    expect(
      schutzfristen([arbeit("2026-11-02")], [{ ...frist, bereitErklaert: true }]).befunde,
    ).toEqual([]);
  });

  it("twelve weeks after a premature or multiple birth, longer by the days lost before", () => {
    expect(schutzfristNachEntbindung("2026-11-02", { zwoelfWochen: true })?.bis).toBe("2027-01-25");
    expect(schutzfristNachEntbindung("2026-11-02", { verlaengerung: 10 })?.bis).toBe("2027-01-07");
  });

  it("after a Fehlgeburt: two weeks from the 13th, six from the 17th, eight from the 20th week", () => {
    expect(schutzfristNachFehlgeburt("2026-10-01", 12)).toBeNull();
    expect(schutzfristNachFehlgeburt("2026-10-01", 13)?.bis).toBe("2026-10-15");
    expect(schutzfristNachFehlgeburt("2026-10-01", 16)?.bis).toBe("2026-10-15");
    expect(schutzfristNachFehlgeburt("2026-10-01", 17)?.bis).toBe("2026-11-12");
    expect(schutzfristNachFehlgeburt("2026-10-01", 20)?.bis).toBe("2026-11-26");
  });

  it("counts a night shift into the next calendar day", () => {
    const frist = { art: "nach_entbindung" as const, von: "2026-11-03", bis: "2026-12-28" };
    expect(schutzfristen([tagAb("2026-11-02", "22:00", 180)], [frist]).befunde).toEqual([
      expect.objectContaining({ tage: ["2026-11-03"] }),
    ]);
  });
});
