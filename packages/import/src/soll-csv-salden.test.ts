import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SOLL_SALDEN_VORLAGE } from "./quellen.ts";
import { sollCsvLesen } from "./soll-csv.ts";

/* The balances on a cut-off date in a Soll-CSV (BAULISTE.md S-708) */

const KOPF = "Typ;Kennung;Person;Datum;Überstunden;Resturlaub";

describe("Soll-CSV: balances on a cut-off date", () => {
  it("reads overtime and leave of a person on the first day of a month", () => {
    const text = [
      KOPF,
      "saldo;s-1;Sandra Kühn;01.10.2026;-3:15;8,5",
      "balance;s-2;Max Brandt;2026-10-01;12,5;",
      "Saldo;s-3;Leon;01.11.2026;;3",
    ].join("\n");
    const { daten, fehler, spalten } = sollCsvLesen(text);
    expect(fehler).toEqual([]);
    expect(spalten).toMatchObject({ ueberstunden: "Überstunden", resturlaub: "Resturlaub" });
    expect(daten.salden).toEqual([
      {
        externalId: "s-1",
        zeile: 2,
        person: "Sandra Kühn",
        stichtag: "2026-10-01",
        ueberstundenMinuten: -195,
        urlaubHalbtage: 17,
      },
      {
        externalId: "s-2",
        zeile: 3,
        person: "Max Brandt",
        stichtag: "2026-10-01",
        ueberstundenMinuten: 750,
        urlaubHalbtage: null,
      },
      {
        externalId: "s-3",
        zeile: 4,
        person: "Leon",
        stichtag: "2026-11-01",
        ueberstundenMinuten: null,
        urlaubHalbtage: 6,
      },
    ]);
  });

  it("finds the columns by English headers too", () => {
    const text = [
      "Type;ID;Employee;Date;Overtime;Remaining leave",
      "balance;b-1;Tom;01.10.2026;1:00;2",
    ];
    const { daten, fehler } = sollCsvLesen(text.join("\n"));
    expect(fehler).toEqual([]);
    expect(daten.salden).toMatchObject([{ ueberstundenMinuten: 60, urlaubHalbtage: 4 }]);
  });

  it("names the line and the reason of a balance it cannot read", () => {
    const text = [
      KOPF,
      "saldo;s-1;Sandra Kühn;15.10.2026;1:00;",
      "saldo;s-2;Sandra Kühn;01.10.2026;viel;",
      "saldo;s-3;Sandra Kühn;01.10.2026;;8,3",
      "saldo;s-4;Sandra Kühn;01.10.2026;;-2",
      "saldo;s-5;Sandra Kühn;01.10.2026;;",
      "saldo;s-6;;01.10.2026;1:00;",
      "saldo;;Sandra Kühn;01.10.2026;1:00;",
    ].join("\n");
    const { daten, fehler } = sollCsvLesen(text);
    expect(daten.salden).toEqual([]);
    expect(fehler).toEqual([
      { zeile: 2, grund: "stichtag_ungueltig", feld: "datum", wert: "15.10.2026" },
      { zeile: 3, grund: "saldo_ungueltig", feld: "ueberstunden", wert: "viel" },
      { zeile: 4, grund: "saldo_ungueltig", feld: "resturlaub", wert: "8,3" },
      { zeile: 5, grund: "saldo_ungueltig", feld: "resturlaub", wert: "-2" },
      { zeile: 6, grund: "saldo_ungueltig", feld: "ueberstunden", wert: "" },
      { zeile: 7, grund: "person_fehlt", feld: "person" },
      { zeile: 8, grund: "kennung_fehlt", feld: "kennung" },
    ]);
  });

  it("reads its own template", () => {
    const { daten, fehler } = sollCsvLesen(SOLL_SALDEN_VORLAGE);
    expect(fehler).toEqual([]);
    expect(daten.salden).toHaveLength(1);
  });

  it("never throws on lines of valid and broken fields", () => {
    const feld = fc.constantFrom("", "saldo", "01.10.2026", "-3:15", "8,5", "x", '"', "1.10.26");
    fc.assert(
      fc.property(fc.array(fc.array(feld, { maxLength: 7 }), { maxLength: 30 }), (zeilen) => {
        const text = [KOPF, ...zeilen.map((z) => z.join(";"))].join("\n");
        const { daten } = sollCsvLesen(text);
        for (const saldo of daten.salden) {
          expect(saldo.stichtag.endsWith("-01")).toBe(true);
          expect(saldo.ueberstundenMinuten !== null || saldo.urlaubHalbtage !== null).toBe(true);
        }
      }),
    );
  });
});
