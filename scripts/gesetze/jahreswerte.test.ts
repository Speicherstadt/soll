import { describe, expect, it } from "vitest";
import {
  kinderkrankentage,
  MINDESTLOHN,
  mindestlohnAm,
  minijobGrenzeAm,
} from "../../packages/arbeitszeit/src/jahreswerte/index.ts";
import {
  fehlendeJahreswerte,
  hoechsteMiLoV,
  type Jahreswerte,
  pruefeJahreswerte,
} from "./jahreswerte.ts";
import { antwort, nachgestellt } from "./nachgestellt.ts";

const WERTE: Jahreswerte = { mindestlohnAm, minijobGrenzeAm, kinderkrankentage };
const schluessel = (heute: string, werte = WERTE) =>
  fehlendeJahreswerte(heute, werte).map((b) => b.schluessel);

describe("yearly values that are missing", () => {
  it("finds none in 2026 or 2027 before 1 October: both years are stored", () => {
    expect(schluessel("2026-11-21")).toEqual([]);
    expect(schluessel("2027-09-30")).toEqual([]);
  });

  it("asks for the next year from 1 October on", () => {
    expect(schluessel("2027-10-01")).toEqual([
      "jahreswert-mindestlohn-2028",
      "jahreswert-minijob-grenze-2028",
      "jahreswert-kinderkrankentage-2028",
    ]);
  });

  it("asks for the current year at any day", () => {
    expect(schluessel("2028-01-02")).toContain("jahreswert-mindestlohn-2028");
    expect(schluessel("2028-01-02")).not.toContain("jahreswert-mindestlohn-2029");
  });

  it("counts a year with a gap in it as missing, never as covered by a neighbour", () => {
    const luecke: Jahreswerte = {
      ...WERTE,
      mindestlohnAm: (tag) =>
        tag === "2026-07-01" ? { ok: false, grund: "nicht_hinterlegt" } : mindestlohnAm(tag),
    };
    expect(schluessel("2026-03-01", luecke)).toEqual(["jahreswert-mindestlohn-2026"]);
  });

  it("says where the value goes and where it comes from", () => {
    const [b] = fehlendeJahreswerte("2027-10-01", WERTE);
    expect(b?.titel).toBe("Mindestlohn 2028 nicht hinterlegt");
    expect(b?.text).toContain("packages/arbeitszeit/src/jahreswerte/werte.ts");
    expect(b?.text).toContain("Mindestlohnanpassungsverordnung");
    expect(b?.text).toContain("nicht hinterlegt");
  });
});

describe("a new minimum wage ordinance", () => {
  const MILOV6 = "https://www.gesetze-im-internet.de/milov6/";
  const index = antwort(
    200,
    "<html><head><title>MiLoV6 - nichtamtliches Inhaltsverzeichnis</title></head></html>",
    {
      "content-type": "text/html; charset=iso-8859-1",
    },
  );

  it("knows the highest ordinance the yearly values cite", () => {
    expect(hoechsteMiLoV(MINDESTLOHN)).toBe(5);
  });

  it("is a finding once gesetze-im-internet.de has it, and nothing while it answers 404", async () => {
    const neu = await pruefeJahreswerte("2026-11-21", WERTE, 5, nachgestellt({ [MILOV6]: index }));
    expect(neu.befunde.map((b) => b.titel)).toEqual([
      "Neue Mindestlohnanpassungsverordnung: MiLoV6",
    ]);
    expect(neu.befunde[0]?.text).toContain(MILOV6);
    const keine = await pruefeJahreswerte("2026-11-21", WERTE, 5, nachgestellt({}));
    expect(keine).toEqual({ befunde: [], warnungen: [] });
  });

  it("warns when the page does not answer or is another page", async () => {
    for (const quelle of [antwort(503), antwort(200, "<title>Wartung</title>")]) {
      const e = await pruefeJahreswerte("2026-11-21", WERTE, 5, nachgestellt({ [MILOV6]: quelle }));
      expect(e.befunde).toEqual([]);
      expect(e.warnungen[0]).toContain(MILOV6);
    }
  });
});
