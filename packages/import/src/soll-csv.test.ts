import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_DATENSAETZE } from "./modell.ts";
import { SOLL_CSV_FELDER, sollCsvLesen } from "./soll-csv.ts";

const KOPF = "Typ;Kennung;Person;Datum;Beginn;Ende;Pause;Bis;Art;Kunde;Name;Nummer";

describe("the reference format Soll-CSV", () => {
  it("reads times, absences, customers and orders with their line and id", () => {
    const text = [
      KOPF,
      "zeit;z-1;Sandra Kühn;01.09.2026;7:00;15:30;30;;;;;",
      "zeit;z-2;Sandra Kühn;2026-09-01;22:00;6:00;0:45;;;;;",
      "abwesenheit;a-1;Max Brandt;07.09.2026;;;;11.09.2026;Urlaub;;;",
      "kunde;k-1;;;;;;;;;Bäckerei Hansen;K-100",
      "projekt;p-1;;;;;;;;k-1;Heizung tauschen;A-17",
    ].join("\r\n");
    const { daten, fehler } = sollCsvLesen(text);
    expect(fehler).toEqual([]);
    expect(daten.zeiten).toEqual([
      {
        externalId: "z-1",
        zeile: 2,
        person: "Sandra Kühn",
        tag: "2026-09-01",
        beginn: 420,
        ende: 930,
        pauseMinuten: 30,
      },
      {
        externalId: "z-2",
        zeile: 3,
        person: "Sandra Kühn",
        tag: "2026-09-01",
        beginn: 1320,
        ende: 360,
        pauseMinuten: 45,
      },
    ]);
    expect(daten.abwesenheiten).toEqual([
      {
        externalId: "a-1",
        zeile: 4,
        person: "Max Brandt",
        art: "Urlaub",
        von: "2026-09-07",
        bis: "2026-09-11",
      },
    ]);
    expect(daten.kunden).toEqual([
      { externalId: "k-1", zeile: 5, name: "Bäckerei Hansen", nummer: "K-100" },
    ]);
    expect(daten.projekte).toEqual([
      { externalId: "p-1", zeile: 6, kunde: "k-1", name: "Heizung tauschen", nummer: "A-17" },
    ]);
  });

  it("reads English headers with commas, columns in any order, and a byte order mark", () => {
    const text =
      "﻿id,type,employee,date,start,end,break\nt1,time,Tom Berger,2026-10-02,10:00,14:00,";
    const { daten, fehler, spalten } = sollCsvLesen(text);
    expect(fehler).toEqual([]);
    expect(daten.zeiten.map((z) => [z.externalId, z.person, z.pauseMinuten])).toEqual([
      ["t1", "Tom Berger", 0],
    ]);
    expect(spalten.typ).toBe("type");
    expect(spalten.kunde).toBeNull();
  });

  it("takes the columns the mapping names over what the header suggests", () => {
    const text = "Typ;Kennung;Wer;Wann;Von;Bis\nzeit;1;Lea Hansen;2026-10-02;8:00;12:00";
    const ohne = sollCsvLesen(text);
    expect(ohne.fehler).toEqual([{ zeile: 2, grund: "person_fehlt", feld: "person" }]);
    const mit = sollCsvLesen(text, { person: "Wer", datum: "Wann", beginn: "Von", ende: "Bis" });
    expect(mit.fehler).toEqual([]);
    expect(mit.daten.zeiten[0]).toMatchObject({ person: "Lea Hansen", beginn: 480, ende: 720 });
  });

  it("names the line and the field of every value it cannot read, and keeps the rest", () => {
    const text = [
      KOPF,
      "zeit;z-1;Sandra;31.09.2026;7:00;15:00;;;;;;",
      "zeit;z-2;Sandra;01.09.2026;7:00;25:00;;;;;;",
      "zeit;z-3;Sandra;01.09.2026;7:00;8:00;90;;;;;",
      "zeit;z-4;Sandra;01.09.2026;7:00;7:00;;;;;;",
      "pause;x-1;Sandra;01.09.2026;;;;;;;;",
      ";z-5;Sandra;01.09.2026;7:00;8:00;;;;;;",
      "zeit;;Sandra;01.09.2026;7:00;8:00;;;;;;",
      "zeit;z-1;Sandra;02.09.2026;7:00;8:00;;;;;;",
      "abwesenheit;a-1;Max;10.09.2026;;;;09.09.2026;Urlaub;;;",
      "abwesenheit;a-2;Max;10.09.2026;;;;;;;;",
      "kunde;k-1;;;;;;;;;;",
      "projekt;p-1;;;;;;;;k-9;Bad;",
      `kunde;k-2;;;;;;;;;${"x".repeat(101)};`,
      "zeit;z-9;Sandra;03.09.2026;7:00;8:00;;;;;;",
    ].join("\n");
    const { daten, fehler } = sollCsvLesen(text);
    expect(fehler).toEqual([
      { zeile: 2, grund: "datum_ungueltig", feld: "datum", wert: "31.09.2026" },
      { zeile: 3, grund: "zeit_ungueltig", feld: "ende", wert: "25:00" },
      { zeile: 4, grund: "pause_ungueltig", feld: "pause", wert: "90" },
      { zeile: 5, grund: "zeit_ungueltig", feld: "ende", wert: "7:00" },
      { zeile: 6, grund: "typ_unbekannt", feld: "typ", wert: "pause" },
      { zeile: 7, grund: "typ_unbekannt", feld: "typ", wert: "" },
      { zeile: 8, grund: "kennung_fehlt", feld: "kennung" },
      { zeile: 9, grund: "kennung_doppelt", feld: "kennung", wert: "z-1" },
      { zeile: 10, grund: "datum_ungueltig", feld: "bis", wert: "09.09.2026" },
      { zeile: 11, grund: "art_fehlt", feld: "art" },
      { zeile: 12, grund: "name_fehlt", feld: "name" },
      { zeile: 13, grund: "kunde_unbekannt", feld: "kunde", wert: "k-9" },
      { zeile: 14, grund: "zu_lang", feld: "name" },
    ]);
    expect(daten.zeiten.map((z) => z.externalId)).toEqual(["z-9"]);
  });

  it("names the line of a quote never closed instead of reading the rest as one field", () => {
    const text = `${KOPF}\nzeit;z-1;"Sandra;01.09.2026;7:00;8:00;;;;;;\nzeit;z-2;Max;01.09.2026;7:00;8:00;;;;;;`;
    expect(sollCsvLesen(text).fehler).toEqual([{ zeile: 2, grund: "unlesbar" }]);
  });

  it("needs a header with type and id, and refuses more records than one import takes", () => {
    expect(sollCsvLesen("").fehler).toEqual([{ zeile: 1, grund: "kein_kopf" }]);
    expect(sollCsvLesen("Person;Datum\nSandra;2026-09-01").fehler).toEqual([
      { zeile: 1, grund: "kein_kopf" },
    ]);
    const viele = `Typ;Kennung;Name\n${"kunde;k;K\n".repeat(MAX_DATENSAETZE + 1)}`;
    expect(sollCsvLesen(viele)).toMatchObject({
      daten: { kunden: [] },
      fehler: [{ zeile: MAX_DATENSAETZE + 2, grund: "zu_viele" }],
    });
  });
});

/** A field as exports write them: valid values, broken ones, quotes, separators, line breaks */
const feld = fc.oneof(
  fc.constantFrom("zeit", "abwesenheit", "kunde", "projekt", "time", "Urlaub", "krank"),
  fc.constantFrom("2026-09-01", "01.09.2026", "29.02.2027", "7:00", "23:59", "24:00", "30", "0:45"),
  fc.constantFrom("", " ", '"', '""', ";", ",", "\n", "\r\n", "\t", "﻿", "k-1", "p-1"),
  fc.string({ maxLength: 12 }),
);

/** Fails a case that takes longer than this: a reader must never hang on a file */
const HOECHSTENS_MS = 1_000;

const schnell = (text: string) => {
  const start = performance.now();
  const gelesen = sollCsvLesen(text);
  expect(performance.now() - start).toBeLessThan(HOECHSTENS_MS);
  return gelesen;
};

describe("Soll-CSV under fuzzing", () => {
  it("never throws or hangs on any text, and names lines that exist", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (text) => {
        const zeilen = text.split("\n").length;
        for (const f of schnell(text).fehler) {
          expect(f.zeile).toBeGreaterThanOrEqual(1);
          expect(f.zeile).toBeLessThanOrEqual(zeilen);
        }
      }),
    );
  });

  it("never throws or hangs on lines of valid and broken fields, and reads each record once", () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray([...SOLL_CSV_FELDER], { minLength: 1 }),
        fc.array(fc.array(feld, { maxLength: 14 }), { maxLength: 30 }),
        fc.constantFrom(";", ",", "\t"),
        (kopf, zeilen, trenner) => {
          const text = [kopf.join(trenner), ...zeilen.map((z) => z.join(trenner))].join("\n");
          const { daten, fehler } = schnell(text);
          const gelesen =
            daten.zeiten.length +
            daten.abwesenheiten.length +
            daten.kunden.length +
            daten.projekte.length;
          expect(gelesen + fehler.length).toBeLessThanOrEqual(Math.max(1, text.split("\n").length));
        },
      ),
    );
  });

  it("reads a large hostile file in time", () => {
    schnell(`${KOPF}\n${'"'.repeat(200_000)}`);
    schnell(`${KOPF}\n${"zeit;z;S;01.09.2026;7:00;8:00\n".repeat(MAX_DATENSAETZE)}`);
    schnell(";".repeat(500_000));
  });
});
