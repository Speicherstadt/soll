import { describe, expect, it } from "vitest";
import type { Tag } from "../kalender/tag.ts";
import { istStichtag, type UrlaubStichtag, urlaubAbStichtag } from "./stichtag.ts";
import { tage } from "./testhilfen.ts";
import { type UrlaubskontoEingaben, urlaubskonto } from "./verfall.ts";

/* docs/regeln.md, R-34 (cases taken literally): a model Mo–Fr with 25 days of leave */
const JAHRE = [2025, 2026, 2027].map((jahr) => ({ jahr, anspruchHalbtage: tage(25) }));
const STICHTAG: UrlaubStichtag = { tag: "2026-10-01", halbtage: tage(8.5) };

const eingaben = (teil: Partial<UrlaubskontoEingaben> = {}): UrlaubskontoEingaben => ({
  jahre: JAHRE.filter((j) => j.jahr <= Number((teil.heute ?? "2026-11-25").slice(0, 4))),
  genommen: [{ tag: "2026-09-10", halbtage: tage(1) }],
  heute: "2026-11-25",
  ...teil,
});

const konto = (teil: Partial<UrlaubskontoEingaben> = {}, stichtag = STICHTAG) => {
  const ab = urlaubAbStichtag(eingaben(teil), stichtag);
  if (!ab.ok) throw new Error(ab.grund);
  const ergebnis = urlaubskonto(ab.wert);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  return ergebnis.wert;
};

const nach = (tag: Tag, halbtage: number) => ({ tag, halbtage });

describe("R-34: Resturlaub zum Stichtag", () => {
  it("erlaubt: cut-off 1.10.2026 with 8,5 days and leave on 10.9.2026 in Soll – 8,5 left, neither the year's 25 days nor the 10.9. count", () => {
    const wert = konto();
    expect(wert.restHalbtage).toBe(tage(8.5));
    expect(wert.toepfe.map((t) => t.jahr)).toEqual([2026]);
  });

  it("Grenze: 0 days on the cut-off date – valid, 0 left", () => {
    expect(konto({}, { tag: "2026-10-01", halbtage: 0 }).restHalbtage).toBe(0);
  });

  it("Verstoß: −2 days – invalid, leave granted beyond the entitlement is not claimed back (§ 5 Abs. 3 BUrlG)", () => {
    expect(urlaubAbStichtag(eingaben(), { tag: "2026-10-01", halbtage: tage(-2) })).toEqual({
      ok: false,
      grund: "ungueltig",
    });
  });

  it("leave after the cut-off date: 2 days on 2 and 3.11.2026 – 6,5 left", () => {
    const genommen = [nach("2026-09-10", 2), nach("2026-11-02", 2), nach("2026-11-03", 2)];
    expect(konto({ genommen }).restHalbtage).toBe(tage(6.5));
  });

  it("next year: on 1.2.2027 – 33,5 left (8,5 of 2026 and 25 of 2027)", () => {
    expect(konto({ heute: "2027-02-01" }).restHalbtage).toBe(tage(33.5));
  });

  it("without a notice: on 1.4.2027 the 8,5 days do not expire – „Hinweis auf Verfall fehlt“", () => {
    const wert = konto({ heute: "2027-04-01" });
    expect(wert.toepfe[0]).toMatchObject({
      jahr: 2026,
      restHalbtage: tage(8.5),
      verfaelltAm: null,
    });
    expect(wert.befunde.map((b) => [b.art, b.jahr])).toContainEqual(["hinweis_fehlt", 2026]);
  });

  it("with a notice on 2.11.2026: on 1.4.2027 the 8,5 days expired at the end of 31.3.2027", () => {
    const wert = konto({ heute: "2027-04-01", hinweise: ["2026-11-02"] });
    expect(wert.toepfe[0]).toMatchObject({ jahr: 2026, verfallenHalbtage: tage(8.5) });
    expect(wert.toepfe[0]?.verfaelltAm).toBe("2027-03-31");
  });

  it("rest of the year before: cut-off 1.2.2026 with 30 days (5 of 2025) – all open on 1.4.2026, as leave of 2026", () => {
    const wert = konto(
      { heute: "2026-04-01", genommen: [] },
      { tag: "2026-02-01", halbtage: tage(30) },
    );
    expect(wert.restHalbtage).toBe(tage(30));
    expect(wert.toepfe).toMatchObject([{ jahr: 2026, verfallstag: "2027-03-31" }]);
  });

  it("a notice before the cut-off date (15.9.2026) does not count: on 1.4.2027 nothing expired", () => {
    const wert = konto({ heute: "2027-04-01", hinweise: ["2026-09-15"] });
    expect(wert.toepfe[0]).toMatchObject({ verfallenHalbtage: 0, restHalbtage: tage(8.5) });
  });

  it("not the first of a month (15.10.2026): invalid", () => {
    expect(istStichtag("2026-10-15")).toBe(false);
    expect(istStichtag("2026-10-01")).toBe(true);
    expect(urlaubAbStichtag(eingaben(), { tag: "2026-10-15", halbtage: 2 }).ok).toBe(false);
  });

  it("a year of the cut-off date the inputs do not hold is invalid, not a guess", () => {
    expect(urlaubAbStichtag(eingaben(), { tag: "2028-01-01", halbtage: 2 }).ok).toBe(false);
  });

  it("keeps a correction of the year before: leave of 2025 the old tool forgot", () => {
    const wert = konto({ anpassungen: [{ jahr: 2025, halbtage: tage(1) }] });
    expect(wert.restHalbtage).toBe(tage(9.5));
  });
});
