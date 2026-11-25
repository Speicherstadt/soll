import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { tabelleVorlageXlsx } from "./vorlage.ts";
import { istZip, MAX_ENTPACKT, xlsxLesen } from "./xlsx.ts";
import { blattXml, mappe } from "./xlsx-testhilfen.ts";
import { zipEintraege } from "./zip.ts";

const zeilenVon = (bytes: Uint8Array, max = 100) => {
  const gelesen = xlsxLesen(bytes, max);
  if ("fehler" in gelesen) throw new Error("unlesbar");
  return gelesen;
};

describe("the first sheet of an Excel workbook (S-702)", () => {
  it("reads shared and inline strings, dates, times and plain numbers by cell", () => {
    const blatt = blattXml(
      [
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><r><t>Be</t></r><r><t>ginn</t></r></is></c><c r="E1" t="str"><f>"Pa"&amp;"use"</f><v>Pause</v></c></row>',
        '<row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3" s="1"><v>46266</v></c><c r="C3" s="2"><v>0.29166666666666669</v></c><c r="D3" s="3"><v>1.0625</v></c><c r="E3"><v>30</v></c></row>',
        '<row r="4"><c r="A4" t="b"><v>1</v></c><c r="B4" t="e"><v>#NV</v></c><c r="C4" t="d"><v>2026-09-01T07:00:00</v></c></row>',
      ].join(""),
    );
    const gelesen = zeilenVon(mappe(blatt, ["Person", "Datum", "Sandra &amp; Kühn"]));
    expect(gelesen.zeilen).toEqual([
      { zeile: 1, felder: ["Person", "Datum", "Beginn", "", "Pause"] },
      { zeile: 3, felder: ["Sandra & Kühn", "2026-09-01", "7:00:00", "25:30:00", "30"] },
      { zeile: 4, felder: ["1", "#NV", "2026-09-01T07:00:00"] },
    ]);
    expect(gelesen.zuViele).toBe(false);
  });

  it("follows the cell before when a cell names no place, and leaves out empty lines", () => {
    const blatt = blattXml(
      '<row><c t="inlineStr"><is><t>a</t></is></c><c t="inlineStr"><is><t>b</t></is></c></row><row><c/></row><row><c t="inlineStr"><is><t>c</t></is></c></row>',
    );
    expect(zeilenVon(mappe(blatt)).zeilen).toEqual([
      { zeile: 1, felder: ["a", "b"] },
      { zeile: 3, felder: ["c"] },
    ]);
  });

  it("counts days from 1904 when the workbook says so", () => {
    const teile = {
      "xl/workbook.xml": new TextEncoder().encode(
        '<workbook><workbookPr date1904="1"/><sheets><sheet r:id="rId1"/></sheets></workbook>',
      ),
    };
    const blatt = blattXml('<row r="1"><c r="A1" s="1"><v>44804</v></c></row>');
    expect(
      zeilenVon(
        mappe(blatt, [], { "xl/worksheets/sheet1.xml": new TextEncoder().encode(blatt), ...teile }),
      ).zeilen,
    ).toEqual([{ zeile: 1, felder: ["2026-09-01"] }]);
  });

  it("leaves out columns past the 200th and stops counting lines past the limit", () => {
    const weit = blattXml('<row r="1"><c r="A1"><v>1</v></c><c r="ZZ1"><v>2</v></c></row>');
    expect(zeilenVon(mappe(weit)).zeilen).toEqual([{ zeile: 1, felder: ["1"] }]);
    const lang = blattXml(
      Array.from({ length: 5 }, (_, i) => `<row r="${i + 1}"><c><v>${i}</v></c></row>`).join(""),
    );
    const gelesen = zeilenVon(mappe(lang), 3);
    expect(gelesen.zeilen).toHaveLength(3);
    expect(gelesen.zuViele).toBe(true);
  });

  it("reads its own template back", () => {
    expect(istZip(tabelleVorlageXlsx())).toBe(true);
    expect(zeilenVon(tabelleVorlageXlsx()).zeilen).toEqual([
      { zeile: 1, felder: ["Person", "Datum", "Beginn", "Ende", "Pause", "Projekt", "Tätigkeit"] },
      {
        zeile: 2,
        felder: ["Sandra Kühn", "2026-09-01", "7:00:00", "15:30:00", "30", "Bad Elbhof", "Montage"],
      },
    ]);
  });
});

describe("a workbook that would harm the server is refused (S-702)", () => {
  it("cuts a zip bomb off at the budget, before it is inflated whole", () => {
    // 51 MiB of zeros pack into about 50 KiB
    const bombe = mappe(blattXml(""), [], {
      "xl/worksheets/sheet2.xml": [new Uint8Array(MAX_ENTPACKT + 1024 * 1024), { level: 1 }],
    });
    expect(bombe.length).toBeLessThan(1024 * 1024);
    const start = performance.now();
    expect(xlsxLesen(bombe, 100)).toEqual({ fehler: "unlesbar" });
    // inflating the budget itself takes about 0.6 s on a free core; a bomb read whole would take
    // its full size in memory and many times as long
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it("counts the budget over all parts together", () => {
    const megabyte = new Uint8Array(1024 * 1024).fill(0x20);
    const teile = Object.fromEntries(
      ["xl/workbook.xml", "xl/sharedStrings.xml", "xl/styles.xml"].map((pfad) => [pfad, megabyte]),
    );
    const gross = mappe(blattXml(""), [], teile);
    // each part alone is within 2.5 MiB, together they are not
    expect("zeilen" in xlsxLesen(gross, 100, 3.5 * 1024 * 1024)).toBe(true);
    expect(xlsxLesen(gross, 100, 2.5 * 1024 * 1024)).toEqual({ fehler: "unlesbar" });
  });

  it("refuses a sheet or shared strings with a DTD (entity expansion, XXE)", () => {
    const lachen =
      '<?xml version="1.0"?><!DOCTYPE s [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;">]><sst><si><t>&b;</t></si></sst>';
    const teile = { "xl/sharedStrings.xml": new TextEncoder().encode(lachen) };
    expect(xlsxLesen(mappe(blattXml(""), [], teile), 100)).toEqual({ fehler: "unlesbar" });
    expect(xlsxLesen(mappe(`<!DOCTYPE x>${blattXml("")}`), 100)).toEqual({ fehler: "unlesbar" });
  });

  it("refuses an encrypted entry, a broken ZIP and a ZIP without a sheet", () => {
    const ganz = mappe(blattXml(""));
    const verschluesselt = ganz.slice();
    // set bit 0 (encrypted) in the flags of every central directory record
    for (let i = 0; i < verschluesselt.length - 4; i++)
      if (
        verschluesselt[i] === 0x50 &&
        verschluesselt[i + 1] === 0x4b &&
        verschluesselt[i + 2] === 1 &&
        verschluesselt[i + 3] === 2
      )
        verschluesselt[i + 8] = (verschluesselt[i + 8] ?? 0) | 1;
    expect(xlsxLesen(verschluesselt, 100)).toEqual({ fehler: "unlesbar" });
    expect(xlsxLesen(ganz.slice(0, ganz.length - 30), 100)).toEqual({ fehler: "unlesbar" });
    expect(xlsxLesen(zipSync({ "a.txt": new Uint8Array([65]) }), 100)).toEqual({
      fehler: "unlesbar",
    });
    expect(zipEintraege(new Uint8Array([0x50, 0x4b, 3, 4]))).toBeNull();
  });
});

describe("review of S-702: the Excel reader", () => {
  it("refuses a DTD in the styles or the relationships of a workbook", () => {
    for (const pfad of ["xl/styles.xml", "xl/_rels/workbook.xml.rels"]) {
      const b = mappe(blattXml('<row r="1"><c><v>1</v></c></row>'), [], {
        [pfad]: new TextEncoder().encode('<!DOCTYPE x [<!ENTITY a "b">]><styleSheet/>'),
      });
      expect(xlsxLesen(b, 10)).toEqual({ fehler: "unlesbar" });
    }
  });

  it("reads a shared-string cell without a value as empty, not as the first string", () => {
    const blatt = blattXml('<row r="1"><c r="A1" t="s"/><c r="B1" t="s"><v>0</v></c></row>');
    expect(zeilenVon(mappe(blatt, ["erster"])).zeilen).toEqual([
      { zeile: 1, felder: ["", "erster"] },
    ]);
  });
});
