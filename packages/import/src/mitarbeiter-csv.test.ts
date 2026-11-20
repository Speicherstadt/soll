import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_PERSONEN, mitarbeiterAusCsv } from "./mitarbeiter-csv.ts";

describe("employees from a CSV file", () => {
  it("reads Excel's semicolons with a byte order mark, roles in German or as codes", () => {
    const text =
      "﻿Name;Rolle\r\nAnna Schulz;Planerin\r\nSandra Kühn;mitarbeiter\r\nMax Brandt;\r\nLeon Albers;Mitarbeiter\r\n";
    expect(mitarbeiterAusCsv(text)).toEqual({
      personen: [
        { zeile: 2, name: "Anna Schulz", rolle: "planer" },
        { zeile: 3, name: "Sandra Kühn", rolle: "mitarbeiter" },
        { zeile: 4, name: "Max Brandt", rolle: "mitarbeiter" },
        { zeile: 5, name: "Leon Albers", rolle: "mitarbeiter" },
      ],
      fehler: [],
    });
  });

  it("joins first and last name and reads commas and English headers", () => {
    expect(
      mitarbeiterAusCsv("First name,Last name,Role\nTom,Berger,employee\nOlena,Koval,"),
    ).toEqual({
      personen: [
        { zeile: 2, name: "Tom Berger", rolle: "mitarbeiter" },
        { zeile: 3, name: "Olena Koval", rolle: "mitarbeiter" },
      ],
      fehler: [],
    });
  });

  it("reads tabs, quoted names and columns in any order, and ignores other columns", () => {
    const text = 'Personalnummer\tNachname\tVorname\n17\t"Nowak"\tPiotr\n18\tYılmaz\t"Yusuf  "';
    expect(mitarbeiterAusCsv(text).personen).toEqual([
      { zeile: 2, name: "Piotr Nowak", rolle: "mitarbeiter" },
      { zeile: 3, name: "Yusuf Yılmaz", rolle: "mitarbeiter" },
    ]);
  });

  it("names the line of a missing name and of an unknown role, and keeps the rest", () => {
    expect(
      mitarbeiterAusCsv("Name;Rolle\n;Planer\nLea Hansen;Chefin\nMia Lorenz;Inhaberin"),
    ).toEqual({
      personen: [{ zeile: 4, name: "Mia Lorenz", rolle: "inhaber" }],
      fehler: [
        { zeile: 2, grund: "name_fehlt" },
        { zeile: 3, grund: "rolle_unbekannt", wert: "Chefin" },
      ],
    });
  });

  it("refuses a device as a person: a terminal is set up by the owner, not imported", () => {
    expect(mitarbeiterAusCsv("Name;Rolle\nTablet;Gerät").fehler).toEqual([
      { zeile: 2, grund: "rolle_unbekannt", wert: "Gerät" },
    ]);
  });

  it("refuses a name over 100 characters, as the invitation does", () => {
    expect(mitarbeiterAusCsv(`Name\n${"x".repeat(101)}`).fehler).toEqual([
      { zeile: 2, grund: "name_zu_lang" },
    ]);
  });

  it("needs a header with a name column", () => {
    expect(mitarbeiterAusCsv("Anna;Planer\nMax;Mitarbeiter")).toEqual({
      personen: [],
      fehler: [{ zeile: 1, grund: "kein_kopf" }],
    });
    expect(mitarbeiterAusCsv("")).toEqual({
      personen: [],
      fehler: [{ zeile: 1, grund: "kein_kopf" }],
    });
  });

  it(`takes at most ${MAX_PERSONEN} people at once`, () => {
    const zeilen = Array.from({ length: MAX_PERSONEN + 1 }, (_, i) => `Person ${i}`);
    expect(mitarbeiterAusCsv(["Name", ...zeilen].join("\n"))).toEqual({
      personen: [],
      fehler: [{ zeile: MAX_PERSONEN + 2, grund: "zu_viele" }],
    });
  });

  it("never throws, and every person has a name of 1 to 100 characters on a line after the header", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (rest) => {
        const { personen } = mitarbeiterAusCsv(`Name;Rolle\n${rest}`);
        for (const person of personen) {
          expect(person.name.length).toBeGreaterThan(0);
          expect(person.name.length).toBeLessThanOrEqual(100);
          expect(person.name).toBe(person.name.trim());
          expect(person.zeile).toBeGreaterThan(1);
        }
      }),
    );
  });

  it("finds every name written to a file again", () => {
    const name = fc
      .string({ minLength: 1, maxLength: 40 })
      .map((text) => text.replace(/\s+/g, " ").trim())
      .filter((text) => text.length > 0);
    fc.assert(
      fc.property(fc.array(name, { maxLength: 20 }), (namen) => {
        const text = ["Name", ...namen.map((n) => `"${n.replaceAll('"', '""')}"`)].join("\r\n");
        expect(mitarbeiterAusCsv(text).personen.map((p) => p.name)).toEqual(namen);
      }),
    );
  });
});
