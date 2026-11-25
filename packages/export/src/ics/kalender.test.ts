import { readFileSync } from "node:fs";
import { schichtZeiten } from "@soll/arbeitszeit";
import { describe, expect, it } from "vitest";
import { type IcsTermin, icsKalender } from "./kalender.ts";

/*
 * The feed of S-503 after RFC 5545. The golden file is compared byte for byte (CRLF stays,
 * .gitattributes): a changed file is a changed feed, look at the difference before replacing it.
 */

const zeiten = (tag: string, beginn: string, ende: string) => {
  const minute = (uhr: string) => {
    const [h = 0, m = 0] = uhr.split(":").map(Number);
    return h * 60 + m;
  };
  const spanne = schichtZeiten(tag, minute(beginn), minute(ende));
  if (!spanne) throw new Error(`no such time: ${tag} ${beginn}`);
  return spanne;
};

const ANGELEGT = Date.UTC(2026, 10, 20, 9, 15, 0);

const termin = (uid: string, spanne: { beginn: number; ende: number }): IcsTermin => ({
  uid,
  ...spanne,
  erstellt: ANGELEGT,
  geaendert: ANGELEGT,
  sequenz: 0,
  titel: "Schicht · Service",
  ort: "Elbe",
  beschreibung: "Pause: 30 min",
});

/** Tom's published shifts at Café Elbblick: a late shift, a night shift and one with a long text */
const TOM = {
  produkt: "-//Soll//Dienstplan//DE",
  name: "Soll · Café Elbblick",
  termine: [
    {
      ...termin("6f1c2d3e-0000-4000-8000-000000000002", zeiten("2026-11-24", "22:00", "06:00")),
      geaendert: Date.UTC(2026, 10, 21, 7, 30, 0),
      sequenz: 2,
      titel: "Schicht · Küche",
    },
    termin("6f1c2d3e-0000-4000-8000-000000000001", zeiten("2026-11-23", "14:00", "22:00")),
    {
      ...termin("6f1c2d3e-0000-4000-8000-000000000003", zeiten("2026-11-27", "07:00", "15:00")),
      titel: "Schicht · Theke, Kasse; Frühstück",
      ort: "Elbe, Övelgönne 1",
      beschreibung:
        "Pause: 45 min\nBitte die Kaffeemaschine entkalken; danach Milch, Hafermilch und Sojamilch nachbestellen.",
    },
  ],
};

const golden = () => readFileSync(new URL("./golden/tom.ics", import.meta.url), "utf8");

/** The unfolded content lines (3.1) */
const zeilen = (ics: string) => ics.replaceAll("\r\n ", "").split("\r\n").slice(0, -1);
const wert = (ics: string, name: string) =>
  zeilen(ics)
    .filter((zeile) => zeile.startsWith(`${name}:`))
    .map((zeile) => zeile.slice(name.length + 1));

describe("icsKalender (RFC 5545)", () => {
  it("matches the golden file byte for byte", () => {
    expect(icsKalender(TOM)).toBe(golden());
  });

  it("ends every line with CRLF and holds no other line break (3.1)", () => {
    const ics = icsKalender(TOM);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
  });

  it("keeps every line at 75 octets or fewer (3.1)", () => {
    for (const zeile of icsKalender(TOM).split("\r\n"))
      expect(new TextEncoder().encode(zeile).length).toBeLessThanOrEqual(75);
  });

  it("has VERSION and PRODID once, and UID and DTSTAMP in every VEVENT (3.6, 3.6.1)", () => {
    const ics = icsKalender(TOM);
    expect(wert(ics, "VERSION")).toEqual(["2.0"]);
    expect(wert(ics, "PRODID")).toHaveLength(1);
    expect(wert(ics, "BEGIN").filter((w) => w === "VEVENT")).toHaveLength(3);
    expect(wert(ics, "UID")).toHaveLength(3);
    expect(wert(ics, "DTSTAMP")).toHaveLength(3);
  });

  it("orders the events by their beginning", () => {
    expect(wert(icsKalender(TOM), "UID")).toEqual([
      "6f1c2d3e-0000-4000-8000-000000000001",
      "6f1c2d3e-0000-4000-8000-000000000002",
      "6f1c2d3e-0000-4000-8000-000000000003",
    ]);
  });

  it("escapes comma and semicolon in a TEXT value and writes a line break as \\n (3.3.11)", () => {
    const ics = icsKalender(TOM);
    expect(wert(ics, "SUMMARY")).toContain("Schicht · Theke\\, Kasse\\; Frühstück");
    expect(wert(ics, "LOCATION")).toContain("Elbe\\, Övelgönne 1");
    expect(wert(ics, "DESCRIPTION")[2]).toMatch(/^Pause: 45 min\\nBitte/);
  });

  it("writes a night shift across midnight in UTC, beginning on its working day (3.3.5)", () => {
    const ics = icsKalender(TOM);
    // 22:00 to 6:00 in winter (+01:00): 21:00Z to 05:00Z the next day
    expect(wert(ics, "DTSTART")[1]).toBe("20261124T210000Z");
    expect(wert(ics, "DTEND")[1]).toBe("20261125T050000Z");
  });

  it("gives the night shift 7 hours when the clocks go forward and 9 when they go back", () => {
    const fruehling = zeiten("2026-03-28", "22:00", "06:00");
    const herbst = zeiten("2026-10-24", "22:00", "06:00");
    const ics = icsKalender({
      ...TOM,
      termine: [termin("maerz", fruehling), termin("oktober", herbst)],
    });
    // 22:00 CET is 21:00Z, 6:00 CEST is 04:00Z: 7 hours
    expect(wert(ics, "DTSTART")[0]).toBe("20260328T210000Z");
    expect(wert(ics, "DTEND")[0]).toBe("20260329T040000Z");
    // 22:00 CEST is 20:00Z, 6:00 CET is 05:00Z: 9 hours
    expect(wert(ics, "DTSTART")[1]).toBe("20261024T200000Z");
    expect(wert(ics, "DTEND")[1]).toBe("20261025T050000Z");
  });

  it("carries the revision in DTSTAMP, LAST-MODIFIED and SEQUENCE (3.8.7.2 to 3.8.7.4)", () => {
    const ics = icsKalender(TOM);
    expect(wert(ics, "SEQUENCE")).toEqual(["0", "2", "0"]);
    expect(wert(ics, "LAST-MODIFIED")[1]).toBe("20261121T073000Z");
    // without METHOD, DTSTAMP is the last revision in the store, as LAST-MODIFIED (3.8.7.2)
    expect(wert(ics, "DTSTAMP")).toEqual(wert(ics, "LAST-MODIFIED"));
    expect(wert(ics, "CREATED")[1]).toBe("20261120T091500Z");
  });

  it("leaves out an empty location or description and has no METHOD", () => {
    const ics = icsKalender({
      ...TOM,
      termine: [{ ...TOM.termine[1], ort: "", beschreibung: "" } as IcsTermin],
    });
    expect(wert(ics, "LOCATION")).toEqual([]);
    expect(wert(ics, "DESCRIPTION")).toEqual([]);
    expect(wert(ics, "METHOD")).toEqual([]);
  });

  it("is an empty calendar without shifts", () => {
    const ics = icsKalender({ ...TOM, termine: [] });
    expect(wert(ics, "BEGIN")).toEqual(["VCALENDAR"]);
    expect(wert(ics, "END")).toEqual(["VCALENDAR"]);
  });
});
