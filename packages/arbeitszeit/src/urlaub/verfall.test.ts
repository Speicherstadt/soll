import { describe, expect, it } from "vitest";
import { tage } from "./testhilfen.ts";
import { type UrlaubskontoEingaben, urlaubskonto } from "./verfall.ts";

/** 2026 with 20 days, of which 17 taken in summer: 3 days left (docs/regeln.md, R-23) */
const REST_3: UrlaubskontoEingaben = {
  jahre: [{ jahr: 2026, anspruchHalbtage: tage(20) }],
  genommen: [{ tag: "2026-08-03", halbtage: tage(17) }],
  heute: "2026-11-20",
};

const konto = (eingaben: Partial<UrlaubskontoEingaben> = {}) => {
  const ergebnis = urlaubskonto({ ...REST_3, ...eingaben });
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

const verfall = (art: string, tag: string, halbtage: number, norm = "§ 7 Abs. 3 BUrlG") => ({
  regel: "R-23",
  norm,
  schwere: "hinweis",
  art,
  tage: [tag],
  jahr: 2026,
  halbtage,
});

/* docs/regeln.md, R-23 (cases taken literally) */
describe("R-23: Übertragung und Verfall", () => {
  it("Verfall mit Hinweis: 3 days left of 2026, notice on 1.10.2026 – „Verfall droht“ until 31.3.2027, then 3 days expire", () => {
    const hinweise = ["2026-10-01"];
    expect(konto({ hinweise, heute: "2027-03-31" }).befunde).toEqual([
      verfall("verfall_droht", "2027-03-31", tage(3)),
    ]);
    const danach = konto({ hinweise, heute: "2027-04-01" });
    expect(danach.befunde).toEqual([verfall("verfallen", "2027-03-31", tage(3))]);
    expect(danach.toepfe[0]).toMatchObject({ verfallenHalbtage: tage(3), restHalbtage: 0 });
    expect(danach.restHalbtage).toBe(0);
  });

  it("Verfall ohne Hinweis: 3 days left of 2026, no notice – from 1.1.2027 „Hinweis auf Verfall fehlt“, the days do not expire", () => {
    expect(konto({ heute: "2027-01-01" }).befunde).toEqual([
      verfall("hinweis_fehlt", "2027-03-31", tage(3)),
    ]);
    const spaeter = konto({ heute: "2029-06-01" });
    expect(spaeter.toepfe[0]).toMatchObject({
      verfallenHalbtage: 0,
      restHalbtage: tage(3),
      verfaelltAm: null,
    });
  });

  it("Hinweis verspätet: notice only on 15.1.2027 – does not expire on 31.3.2027 but at the end of 31.3.2028", () => {
    const hinweise = ["2027-01-15"];
    expect(konto({ hinweise, heute: "2027-04-01" }).toepfe[0]).toMatchObject({
      restHalbtage: tage(3),
      verfaelltAm: "2028-03-31",
    });
    expect(konto({ hinweise, heute: "2028-04-01" }).toepfe[0]?.verfallenHalbtage).toBe(tage(3));
  });

  it("Hinweis fällig: leave of 2026, no notice yet, as of 20.11.2026 – „Hinweis auf Verfall fällig bis 31.12.2026“", () => {
    expect(konto().befunde).toEqual([verfall("hinweis_faellig", "2026-12-31", tage(3))]);
    expect(konto({ heute: "2026-12-31" }).befunde[0]?.art).toBe("hinweis_faellig");
  });

  it("Teilurlaub übertragen: Eintritt 1.8.2026, 8,5 days, carry-over asked, notice on 1.9.2026 – expires at the end of 31.12.2027", () => {
    const eingaben = {
      jahre: [
        { jahr: 2026, anspruchHalbtage: tage(8.5), teilurlaubA: true, uebertragungVerlangt: true },
      ],
      genommen: [],
      hinweise: ["2026-09-01"],
    };
    expect(konto({ ...eingaben, heute: "2027-06-01" }).befunde).toEqual([
      verfall("verfall_droht", "2027-12-31", tage(8.5), "§ 7 Abs. 3 Satz 4 BUrlG"),
    ]);
    expect(konto({ ...eingaben, heute: "2028-01-01" }).toepfe[0]?.verfallenHalbtage).toBe(
      tage(8.5),
    );
    // without the request it expires on 31.3.2027 like any leave
    const ohne = {
      ...eingaben,
      jahre: [{ jahr: 2026, anspruchHalbtage: tage(8.5), teilurlaubA: true }],
    };
    expect(konto({ ...ohne, heute: "2027-04-01" }).toepfe[0]?.verfallenHalbtage).toBe(tage(8.5));
  });
});

describe("Urlaubskonto", () => {
  it("takes leave from the oldest year first, and not from a year that has expired", () => {
    const wert = konto({
      jahre: [
        { jahr: 2026, anspruchHalbtage: tage(20) },
        { jahr: 2027, anspruchHalbtage: tage(20) },
      ],
      genommen: [
        { tag: "2026-08-03", halbtage: tage(17) },
        { tag: "2027-02-01", halbtage: tage(2) },
        { tag: "2027-05-03", halbtage: tage(5) },
      ],
      hinweise: ["2026-10-01", "2027-01-10"],
      heute: "2027-06-01",
    });
    // 2 days in February from 2026, 1 day of 2026 expired on 31.3.2027, May from 2027
    expect(
      wert.toepfe.map((t) => [t.jahr, t.genommenHalbtage, t.verfallenHalbtage, t.restHalbtage]),
    ).toEqual([
      [2026, tage(19), tage(1), 0],
      [2027, tage(5), 0, tage(15)],
    ]);
    expect(wert.restHalbtage).toBe(tage(15));
    expect(wert.befunde.map((b) => b.art)).toEqual(["verfallen", "verfall_droht"]);
  });

  it("uses leave carried over without notice even years later", () => {
    const wert = konto({
      jahre: [
        { jahr: 2026, anspruchHalbtage: tage(20) },
        { jahr: 2027, anspruchHalbtage: tage(20) },
      ],
      genommen: [
        { tag: "2026-08-03", halbtage: tage(17) },
        { tag: "2027-08-02", halbtage: tage(4) },
      ],
      heute: "2027-09-01",
    });
    expect(wert.toepfe.map((t) => t.restHalbtage)).toEqual([0, tage(19)]);
  });

  it("adds a remainder by hand, charges leave beyond what is open to its own year", () => {
    const wert = konto({
      jahre: [{ jahr: 2026, anspruchHalbtage: tage(20) }],
      anpassungen: [{ jahr: 2025, halbtage: tage(4) }],
      genommen: [{ tag: "2026-03-02", halbtage: tage(25) }],
      hinweise: ["2025-06-01"],
    });
    // the 4 days of 2025 expired on 31.3.2026, but leave on 2.3. took them first
    expect(wert.toepfe.map((t) => [t.jahr, t.restHalbtage])).toEqual([
      [2025, 0],
      [2026, tage(-1)],
    ]);
  });

  it("counts half days and ignores notices after today", () => {
    const wert = konto({
      genommen: [{ tag: "2026-08-03", halbtage: 33 }],
      hinweise: ["2026-12-01"],
    });
    expect(wert.restHalbtage).toBe(7);
    expect(wert.toepfe[0]?.hinweis).toBeNull();
  });

  it("refuses invalid entries", () => {
    expect(urlaubskonto({ ...REST_3, heute: "2026-02-30" }).ok).toBe(false);
    expect(urlaubskonto({ ...REST_3, genommen: [{ tag: "2026-08-03", halbtage: 0 }] }).ok).toBe(
      false,
    );
    expect(
      urlaubskonto({ ...REST_3, jahre: [...REST_3.jahre, { jahr: 2026, anspruchHalbtage: 2 }] }).ok,
    ).toBe(false);
  });
});
