import { describe, expect, it } from "vitest";
import { MAX_DATENSAETZE } from "./modell.ts";
import { tabelleLesen } from "./tabelle.ts";
import { inhaltsKennung } from "./tabelle-zeile.ts";
import { TABELLE_VORLAGE_CSV, tabelleVorlageXlsx } from "./vorlage.ts";
import { blattXml, mappe } from "./xlsx-testhilfen.ts";

const bytes = (text: string) => new TextEncoder().encode(text);
const lesen = (zeilen: string[], wahl = {}) => tabelleLesen(bytes(zeilen.join("\r\n")), wahl);

describe("a spreadsheet of times with free columns (S-702)", () => {
  it("proposes the columns from German headers and reads German values", () => {
    const gelesen = lesen([
      "Mitarbeiter;Datum;Kommen;Gehen;Pause;Baustelle;Tätigkeit;Bemerkung",
      "Sandra Kühn;1.9.26;7:00;15:30;0,5;Bad Elbhof;Montage;x",
      "Sandra Kühn;02.09.2026;0700;1600;30;;;",
    ]);
    expect(gelesen.fehler).toEqual([]);
    expect(gelesen.spalten).toEqual({
      kennung: null,
      person: "Mitarbeiter",
      datum: "Datum",
      beginn: "Kommen",
      ende: "Gehen",
      dauer: null,
      pause: "Pause",
      projekt: "Baustelle",
      taetigkeit: "Tätigkeit",
    });
    const [eins, zwei] = gelesen.daten.zeiten;
    expect(eins).toEqual({
      externalId: inhaltsKennung({
        person: "Sandra Kühn",
        tag: "2026-09-01",
        beginn: 420,
        ende: 930,
        pauseMinuten: 30,
      }),
      zeile: 2,
      person: "Sandra Kühn",
      tag: "2026-09-01",
      beginn: 420,
      ende: 930,
      pauseMinuten: 30,
      projekt: "Bad Elbhof",
      taetigkeit: "Montage",
    });
    expect(zwei).toMatchObject({ zeile: 3, tag: "2026-09-02", ende: 960 });
    expect(zwei).not.toHaveProperty("projekt");
  });

  it("takes the columns the owner chooses, and none where they choose none", () => {
    const zeilen = ["Wer,Wann,A,B,Stunden", "Tom Berger,2026-10-02,10:00,14:30,4"];
    expect(lesen(zeilen).fehler).toEqual([
      { zeile: 1, grund: "spalte_fehlt", feld: "person" },
      { zeile: 1, grund: "spalte_fehlt", feld: "datum" },
      { zeile: 1, grund: "spalte_fehlt", feld: "beginn" },
    ]);
    const wahl = { person: "Wer", datum: "Wann", beginn: "A", ende: "B" };
    // "Stunden" is proposed as the duration and disagrees with 10:00 to 14:30; "" chooses none
    expect(lesen(zeilen, wahl).fehler).toEqual([
      { zeile: 2, grund: "dauer_abweichend", feld: "dauer", spalte: "Stunden", wert: "4" },
    ]);
    expect(lesen(zeilen, { ...wahl, dauer: "" }).fehler).toEqual([]);
    expect(lesen(zeilen, { ...wahl, dauer: "" }).daten.zeiten[0]).toMatchObject({
      beginn: 600,
      ende: 870,
    });
  });

  it("takes the end from begin, duration and break when there is no end", () => {
    const gelesen = lesen([
      "Person;Datum;Beginn;Dauer;Pause",
      "Max Brandt;01.10.2026;7:00;7,5;30",
      "Max Brandt;02.10.2026;22:00;7:30;0:30",
      "Max Brandt;03.10.2026;7:00;7,33;",
    ]);
    expect(gelesen.fehler).toEqual([]);
    expect(gelesen.daten.zeiten.map(({ ende }) => ende)).toEqual([900, 360, 860]);
  });

  it("reads date and time from one column chosen for both", () => {
    const gelesen = lesen(["Name;Start;Ende", "Lea;01.09.2026 22:00;01.09.2026 06:00"], {
      datum: "Start",
      beginn: "Start",
    });
    expect(gelesen.fehler).toEqual([]);
    expect(gelesen.daten.zeiten[0]).toMatchObject({ tag: "2026-09-01", beginn: 1320, ende: 360 });
  });

  it("names line, field and column of every line it refuses", () => {
    const gelesen = lesen([
      "Person;Datum;Beginn;Ende;Pause;Projekt",
      ";01.09.2026;7:00;15:30;30;",
      "Sandra;31.09.2026;7:00;15:30;30;",
      "Sandra;01.09.2026;7 Uhr;15:30;30;",
      "Sandra;01.09.2026;7:00;7:00;;",
      "Sandra;01.09.2026;7:00;8:00;60;",
      `Sandra;01.09.2026;7:00;8:00;;${"x".repeat(101)}`,
    ]);
    expect(gelesen.fehler.map(({ wert: _, ...f }) => f)).toEqual([
      { zeile: 2, grund: "person_fehlt", feld: "person", spalte: "Person" },
      { zeile: 3, grund: "datum_ungueltig", feld: "datum", spalte: "Datum" },
      { zeile: 4, grund: "zeit_ungueltig", feld: "beginn", spalte: "Beginn" },
      { zeile: 5, grund: "zeit_ungueltig", feld: "ende", spalte: "Ende" },
      { zeile: 6, grund: "pause_ungueltig", feld: "pause", spalte: "Pause" },
      { zeile: 7, grund: "zu_lang", feld: "projekt", spalte: "Projekt" },
    ]);
    expect(gelesen.fehler[1]?.wert).toBe("31.09.2026");
  });

  it("keys a line by its content, wherever it stands and whatever else the file holds", () => {
    const kopf = "Person;Datum;Beginn;Ende;Pause";
    const a = "Sandra;01.09.2026;7:00;15:30;30";
    const b = "Max;01.09.2026;7:00;15:30;30";
    const erste = lesen([kopf, a, b]).daten.zeiten;
    // the same line written another way, moved, with a line added before it
    const zweite = lesen([
      kopf,
      "Sandra;02.09.2026;7:00;8:00;",
      b,
      "Sandra;2026-09-01;0700;15:30:00;0:30",
    ]).daten.zeiten;
    expect(zweite[2]?.externalId).toBe(erste[0]?.externalId);
    expect(zweite[1]?.externalId).toBe(erste[1]?.externalId);
    expect(new Set(zweite.map((z) => z.externalId)).size).toBe(3);
  });

  it("refuses the same line twice, and the same id twice when there is an id column", () => {
    expect(
      lesen(["Person;Datum;Beginn;Ende", "S;01.09.2026;7:00;8:00", "S;1.9.26;7:00;8:00"]).fehler,
    ).toEqual([{ zeile: 3, grund: "zeile_doppelt" }]);
    const mitKennung = lesen([
      "ID;Person;Datum;Beginn;Ende",
      "e-1;S;01.09.2026;7:00;8:00",
      "e-1;S;02.09.2026;7:00;8:00",
      ";S;03.09.2026;7:00;8:00",
    ]);
    expect(mitKennung.daten.zeiten.map((z) => z.externalId)).toEqual(["e-1"]);
    expect(mitKennung.fehler).toEqual([
      { zeile: 3, grund: "kennung_doppelt", feld: "kennung", spalte: "ID", wert: "e-1" },
      { zeile: 4, grund: "kennung_fehlt", feld: "kennung", spalte: "ID" },
    ]);
  });

  it("reads a workbook and a CSV in Windows-1252 alike", () => {
    const blatt = blattXml(
      '<row r="1"><c t="s"><v>0</v></c><c t="s"><v>1</v></c><c t="s"><v>2</v></c><c t="s"><v>3</v></c></row><row r="2"><c t="s"><v>4</v></c><c s="1"><v>46266</v></c><c s="2"><v>0.29166666666666669</v></c><c s="2"><v>0.64583333333333337</v></c></row>',
    );
    const xlsx = tabelleLesen(mappe(blatt, ["Person", "Datum", "Beginn", "Ende", "Jürgen"]));
    expect(xlsx.fehler).toEqual([]);
    expect(xlsx.daten.zeiten[0]).toMatchObject({
      person: "Jürgen",
      tag: "2026-09-01",
      beginn: 420,
      ende: 930,
    });
    const ansi = new Uint8Array([
      ...bytes("Person;Datum;Beginn;Ende\r\nJ"),
      0xfc,
      ...bytes("rgen;01.09.2026;7:00;15:30"),
    ]);
    expect(tabelleLesen(ansi).daten.zeiten[0]?.person).toBe("Jürgen");
  });

  it("reads both templates as the same time", () => {
    const csv = tabelleLesen(bytes(TABELLE_VORLAGE_CSV));
    const xlsx = tabelleLesen(tabelleVorlageXlsx());
    expect(csv.fehler).toEqual([]);
    expect(xlsx.fehler).toEqual([]);
    expect(xlsx.daten).toEqual(csv.daten);
    expect(csv.daten.zeiten).toHaveLength(1);
  });

  it("refuses a file that is no table, and one with too many lines", () => {
    expect(tabelleLesen(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])).fehler).toEqual([
      { zeile: 1, grund: "unlesbar" },
    ]);
    expect(tabelleLesen(new Uint8Array()).fehler).toEqual([{ zeile: 1, grund: "kein_kopf" }]);
    const viele = [
      "Person;Datum;Beginn;Ende",
      ...Array(MAX_DATENSAETZE + 1).fill("S;01.09.2026;7:00;8:00"),
    ];
    expect(lesen(viele).fehler).toEqual([{ zeile: MAX_DATENSAETZE + 2, grund: "zu_viele" }]);
  });
});

describe("review of S-702", () => {
  it("accepts a duration that matches begin and end with seconds", () => {
    expect(
      lesen(["Person;Datum;Beginn;Ende;Dauer", "Max;01.09.2026;07:00:30;15:00:30;8:00:00"]).fehler,
    ).toEqual([]);
  });

  it("names a chosen column that is not in the file", () => {
    expect(
      lesen(["Person;Datum;Beginn;Ende;Pause", "Max;01.09.2026;7:00;15:30;30"], { pause: "Pausen" })
        .fehler,
    ).toContainEqual({ zeile: 1, grund: "spalte_fehlt", feld: "pause" });
  });
});

describe("review of S-702, round 2: seconds", () => {
  const zeile = (beginn: string, ende: string, dauer = "") =>
    lesen(["Person;Datum;Beginn;Ende;Dauer", `Max;01.09.2026;${beginn};${ende};${dauer}`]);

  it("refuses a duration two minutes off, compared in seconds", () => {
    // the span is 7:59:02; 8:01 is two minutes more
    expect(zeile("07:00:59", "15:00:01", "8:01").fehler).toEqual([
      { zeile: 2, grund: "dauer_abweichend", feld: "dauer", spalte: "Dauer", wert: "8:01" },
    ]);
  });

  it("accepts a duration within the rounding of its own last digit", () => {
    expect(zeile("07:00:30", "15:00:30", "8:00:00").fehler).toEqual([]);
    // 8:00:20 written to the minute, 7:28 written to a tenth of an hour (six minutes)
    expect(zeile("07:00:00", "15:00:20", "8:00").fehler).toEqual([]);
    expect(zeile("07:00", "14:28", "7,5").fehler).toEqual([]);
    expect(zeile("07:00", "14:20", "7,5").fehler.map((f) => f.grund)).toEqual(["dauer_abweichend"]);
    // whole hours count as written to the minute
    expect(zeile("07:00", "14:35", "8").fehler.map((f) => f.grund)).toEqual(["dauer_abweichend"]);
  });

  it("makes no minute of work from an end at or seconds before the begin", () => {
    for (const ende of ["07:00:15", "07:00:30"])
      expect(zeile("07:00:30", ende).fehler).toEqual([
        { zeile: 2, grund: "zeit_ungueltig", feld: "ende", spalte: "Ende", wert: ende },
      ]);
    // also in the last minute of the day, where the end rounded up would be midnight (round 3)
    expect(zeile("23:59:50", "23:59:40").fehler).toEqual([
      { zeile: 2, grund: "zeit_ungueltig", feld: "ende", spalte: "Ende", wert: "23:59:40" },
    ]);
    // an end before the begin on another minute lies on the next day, as without seconds
    expect(zeile("22:00:30", "06:00:15").daten.zeiten[0]).toMatchObject({
      beginn: 1320,
      ende: 361,
    });
  });
});
