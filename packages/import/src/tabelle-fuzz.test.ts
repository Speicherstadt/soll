import fc from "fast-check";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { Gelesen } from "./modell.ts";
import { tabelleLesen } from "./tabelle.ts";
import { tabelleVorlageXlsx } from "./vorlage.ts";
import { blattXml, mappe } from "./xlsx-testhilfen.ts";
import { inZeit } from "./zeit-testhilfen.ts";

/*
 * Fuzzing the reader of spreadsheets (BAULISTE.md S-702): no input makes it throw or take a second,
 * and every line it refuses is named with its number, and with its column wherever a field is at
 * fault. Inputs: any bytes, CSV lines of valid and broken fields, real and broken ZIPs, workbooks
 * with random sheets, and the template with bytes changed.
 */

const geprueft = (bytes: Uint8Array, wahl = {}): Gelesen => {
  const gelesen = inZeit(() => tabelleLesen(bytes, wahl));
  for (const fehler of gelesen.fehler) {
    expect(Number.isInteger(fehler.zeile) && fehler.zeile >= 1).toBe(true);
    if (fehler.feld !== undefined && fehler.grund !== "spalte_fehlt")
      expect(typeof fehler.spalte).toBe("string");
  }
  for (const zeit of gelesen.daten.zeiten) {
    expect(zeit.pauseMinuten).toBeLessThan(
      zeit.ende > zeit.beginn ? zeit.ende - zeit.beginn : zeit.ende + 1440 - zeit.beginn,
    );
    expect([zeit.beginn, zeit.ende].every((m) => Number.isInteger(m) && m >= 0 && m < 1440)).toBe(
      true,
    );
  }
  return gelesen;
};

const utf8 = (text: string) => new TextEncoder().encode(text);

const FELD = fc.oneof(
  fc.constantFrom(
    "Sandra",
    "01.09.2026",
    "1.9.26",
    "46266",
    "7:00",
    "0700",
    "15:30:59",
    "0,5",
    "7,5",
    "30",
    "",
    "Bad Elbhof",
  ),
  fc.constantFrom(
    '"',
    '""',
    ";",
    ",",
    "\t",
    "\r\n",
    "&amp;",
    "<",
    "31.02.2026",
    "25:00",
    "-1",
    "1e9",
  ),
  fc.string({ maxLength: 12 }),
);

const ZEILE = fc.array(FELD, { maxLength: 9 }).map((felder) => felder.join(";"));

describe("fuzzing the spreadsheet reader (S-702)", () => {
  it("any bytes", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 2000 }), (bytes) => void geprueft(bytes)),
      {
        numRuns: 300,
      },
    );
  });

  it("bytes that start like a ZIP", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 2000 }), (rest) => {
        geprueft(new Uint8Array([0x50, 0x4b, 3, 4, ...rest]));
      }),
      { numRuns: 300 },
    );
  });

  it("CSV lines of valid and broken fields, with and without a chosen column", () => {
    const kopf = "Person;Datum;Beginn;Ende;Dauer;Pause;Projekt;Tätigkeit;ID";
    fc.assert(
      fc.property(
        fc.array(ZEILE, { maxLength: 30 }),
        fc.constantFrom({}, { kennung: "" }, { dauer: "", kennung: "" }, { datum: "Beginn" }),
        (zeilen, wahl) => void geprueft(utf8([kopf, ...zeilen].join("\r\n")), wahl),
      ),
      { numRuns: 300 },
    );
  });

  it("workbooks with random cells and markup in the sheet", () => {
    const zelle = fc
      .tuple(
        fc.constantFrom(
          "",
          ' t="s"',
          ' t="inlineStr"',
          ' t="str"',
          ' s="1"',
          ' s="2"',
          ' s="3"',
          ' r="ZZZ9"',
          ' r="A0"',
        ),
        fc.oneof(
          fc.constantFrom("0", "4", "46266.3125", "0.3125", "x", "&lt;", "&#xD800;", "-1"),
          fc.string({ maxLength: 8 }),
        ),
      )
      .map(([merkmale, wert]) => `<c${merkmale}><v>${wert}</v><is><t>${wert}</t></is></c>`);
    const zeile = fc
      .array(zelle, { maxLength: 8 })
      .map((zellen) => `<row>${zellen.join("")}</row>`);
    const muell = fc.constantFrom("<", ">", "<!--", "<![CDATA[", "</row>", "<row r='x'>", '"', "&");
    fc.assert(
      fc.property(
        fc.array(fc.oneof(zeile, muell), { maxLength: 20 }),
        fc.array(fc.string(), { maxLength: 5 }),
        (teile, texte) => {
          geprueft(mappe(blattXml(teile.join("")), texte));
        },
      ),
      { numRuns: 200 },
    );
  });

  it("ZIPs with random parts under the names of a workbook", () => {
    const name = fc.constantFrom(
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/sharedStrings.xml",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
      "XL/WORKSHEETS/SHEET1.XML",
    );
    fc.assert(
      fc.property(fc.dictionary(name, fc.string({ maxLength: 200 }), { maxKeys: 6 }), (teile) => {
        geprueft(zipSync(Object.fromEntries(Object.entries(teile).map(([k, v]) => [k, utf8(v)]))));
      }),
      { numRuns: 200 },
    );
  });

  it("the template with bytes changed or cut", () => {
    const vorlage = tabelleVorlageXlsx();
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.nat({ max: vorlage.length - 1 }), fc.integer({ min: 0, max: 255 })), {
          maxLength: 8,
        }),
        fc.nat({ max: vorlage.length }),
        (aenderungen, laenge) => {
          const kaputt = vorlage.slice(0, Math.max(laenge, 4));
          for (const [stelle, wert] of aenderungen)
            if (stelle < kaputt.length) kaputt[stelle] = wert;
          geprueft(kaputt);
        },
      ),
      { numRuns: 300 },
    );
  });
});

/** The largest file the server accepts (apps/server/src/modules/umzug/datei.ts) */
const MAX_BYTES = 5 * 1024 * 1024;

describe("the spreadsheet reader stays within 1 s for any file the server accepts (S-702)", () => {
  const KOPF = "Person;Datum;Beginn;Ende;Pause\n";
  for (const [name, text] of [
    ["a header of 5 MiB of semicolons", ";".repeat(MAX_BYTES)],
    ["a quote never closed", KOPF + '"'.repeat(MAX_BYTES - KOPF.length)],
    ["one long field", KOPF + "x".repeat(MAX_BYTES - KOPF.length)],
    ["many short lines", KOPF + "S;01.09.2026;7:00;8:00;\n".repeat(19_000)],
  ] as const)
    it(name, () => void geprueft(utf8(text)));

  it("a workbook whose shared string of 1 MiB fills every cell", () => {
    const zeilen = Array.from(
      { length: 2000 },
      (_, i) =>
        `<row r="${i + 1}">${Array.from({ length: 10 }, () => '<c t="s"><v>0</v></c>').join("")}</row>`,
    ).join("");
    const bytes = mappe(blattXml(zeilen), ["x".repeat(1024 * 1024)]);
    expect(bytes.length).toBeLessThan(MAX_BYTES);
    geprueft(bytes, { person: "", datum: "" });
  });
});
