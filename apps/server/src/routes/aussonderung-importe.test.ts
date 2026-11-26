import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aussondern } from "../modules/arbeitszeit/index.ts";
import { kettePruefen, schreiben } from "../modules/audit/index.ts";
import { dateispeicher } from "../modules/umzug/index.ts";
import { testServer } from "../test-server.ts";
import { IMP, JETZT, uebernehmen, weberZumUmzug } from "./importe-testhilfen.ts";
import { abschliessen, bestaetigen } from "./monat-testhilfen.ts";
import { json } from "./projektzeit-testhilfen.ts";

/*
 * Retention of imports, their original files in dateien/ and shift swaps (schichttausche):
 * - An import row and its original file stay until every month of its imported times and absences
 *   has been removed; a file shared by two businesses stays until both imports are gone.
 * - A shift swap is removed two years after the end of the calendar year of its shift.
 */

const um = (iso: string) => Date.parse(iso);
const SILVESTER_2028 = um("2028-12-31T23:59:59+01:00");
const NEUJAHR_2029 = um("2029-01-01T00:00:00+01:00");
const NEUJAHR_2035 = um("2035-01-01T00:00:00+01:00");

let ordner: string;
beforeEach(() => {
  ordner = mkdtempSync(join(tmpdir(), "soll-aussondern-imp-"));
});
afterEach(() => {
  rmSync(ordner, { recursive: true, force: true });
});

describe("retention of imports and shift swaps", () => {
  it("keeps import and file until every month of its times is removed, and respects shared files", async () => {
    const speicher = dateispeicher(() => ordner);
    const w = await weberZumUmzug();
    const zweiter = await w.server.inhaberMitBetrieb("Café Elbblick", "elbblick");

    const csv = [
      "Typ;Kennung;Person;Datum;Beginn;Ende;Pause;Bis;Art;Kunde;Name;Nummer",
      "zeit;z-1;Sandra;01.09.2026;7:00;15:30;30;;;;;",
      "zeit;z-2;Sandra;01.10.2026;7:00;15:30;30;;;;;",
    ].join("\r\n");
    const dateiBytes = new TextEncoder().encode(csv);
    const sha = await speicher.speichern(dateiBytes);
    const dateiObj = { name: "zeiten.csv", inhalt: Buffer.from(dateiBytes).toString("base64") };

    await uebernehmen(w.weber, {
      quelle: "soll-csv",
      datei: dateiObj,
      spalten: {},
      zuordnung: {
        personen: { Sandra: w.sandra.nutzerId },
        arten: {},
        kunden: {},
        projekte: {},
        taetigkeiten: {},
      },
      abgeschlossenBis: "2026-09",
    });

    // Save same file for second business with no stamps removed yet
    await uebernehmen(zweiter, {
      quelle: "soll-csv",
      datei: dateiObj,
      spalten: {},
      zuordnung: {
        personen: { Sandra: zweiter.nutzerId },
        arten: {},
        kunden: {},
        projekte: {},
        taetigkeiten: {},
      },
      abgeschlossenBis: null,
    });

    const anzahlImporte = (betriebId: string) =>
      (
        w.server.sqlite
          .query("SELECT count(*) AS n FROM importe WHERE betrieb_id = ?")
          .get(betriebId) as { n: number }
      ).n;

    expect(anzahlImporte(w.weber.betriebId)).toBe(1);
    expect(await speicher.pruefen(sha)).toBe("ok");

    // 2035-01-01: September 2026 is removed, October 2026 is NOT closed yet -> import & file stay
    const geloescht: string[] = [];
    aussondern(w.server.db, w.server.schreibDb, NEUJAHR_2035, {
      dateiLoeschen: (s) => {
        geloescht.push(s);
        void speicher.loeschen(s);
      },
    });
    expect(anzahlImporte(w.weber.betriebId)).toBe(1);
    expect(geloescht).toEqual([]);

    // Close October 2026 in 2026 (at JETZT) -> removed on 2035-01-01, but second business still holds sha
    w.server.stelleUhr(JETZT);
    expect((await bestaetigen(w.sandra, "2026-10")).status).toBe(201);
    expect((await abschliessen(w.weber, w.sandra.nutzerId, { monat: "2026-10" })).status).toBe(201);
    const res2 = aussondern(w.server.db, w.server.schreibDb, NEUJAHR_2035, {
      dateiLoeschen: (s) => {
        geloescht.push(s);
        void speicher.loeschen(s);
      },
    });
    expect(res2.ausgesondert).toHaveLength(1);
    expect(anzahlImporte(w.weber.betriebId)).toBe(0);
    expect(anzahlImporte(zweiter.betriebId)).toBe(1);
    expect(geloescht).toEqual([]);
    expect(await speicher.pruefen(sha)).toBe("ok");

    // Now close second business's September & October 2026 and run aussondern -> file is removed
    for (const m of ["2026-09", "2026-10"]) {
      expect((await bestaetigen(zweiter, m)).status).toBe(201);
      expect((await abschliessen(zweiter, zweiter.nutzerId, { monat: m })).status).toBe(201);
    }
    aussondern(w.server.db, w.server.schreibDb, NEUJAHR_2035, {
      dateiLoeschen: (s) => {
        geloescht.push(s);
        void speicher.loeschen(s);
      },
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(anzahlImporte(zweiter.betriebId)).toBe(0);
    expect(geloescht).toEqual([sha]);
    expect(await speicher.pruefen(sha)).toBe("fehlt");
    expect(kettePruefen(w.server.db, w.weber.betriebId)).toEqual([]);
    expect(kettePruefen(w.server.db, zweiter.betriebId)).toEqual([]);

    // Silence unused import warning for json
    expect(typeof json).toBe("function");
    expect(IMP).toBe("/api/v1/importe");
  });

  it("removes shift swaps two years after the calendar year of their shift", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const sandra = await server.eingeladen(weber, "mitarbeiter", "sandra");

    schreiben(
      server.schreibDb,
      { betriebId: weber.betriebId, akteur: weber.nutzerId, jetzt: JETZT },
      (s) => {
        s.einfuegen("schichten", {
          betriebId: weber.betriebId,
          schichtId: "sh-1",
          standortId: "st-1",
          tag: "2026-09-01",
          beginn: um("2026-09-01T08:00:00+02:00"),
          ende: um("2026-09-01T16:00:00+02:00"),
          pauseMinuten: 30,
          rolle: "Monteur",
          nutzerId: sandra.nutzerId,
          veroeffentlichtAm: JETZT,
          angelegtVon: weber.nutzerId,
          angelegtAm: JETZT,
          importId: null,
          externQuelle: null,
          externId: null,
        });
        s.einfuegen("schichttausche", {
          betriebId: weber.betriebId,
          tauschId: "t-1",
          schichtId: "sh-1",
          anbieterId: sandra.nutzerId,
          anNutzerId: null,
          uebernehmerId: null,
          status: "hinfaellig",
          grund: null,
          angebotenAm: um("2026-08-30T10:00:00+02:00"),
          uebernommenAm: null,
          entschiedenVon: null,
          entschiedenAm: null,
        });
      },
    );

    const anzahlTausche = () =>
      (
        server.sqlite
          .query("SELECT count(*) AS n FROM schichttausche WHERE betrieb_id = ?")
          .get(weber.betriebId) as { n: number }
      ).n;

    aussondern(server.db, server.schreibDb, SILVESTER_2028);
    expect(anzahlTausche()).toBe(1);

    aussondern(server.db, server.schreibDb, NEUJAHR_2029);
    expect(anzahlTausche()).toBe(0);
    expect(kettePruefen(server.db, weber.betriebId)).toEqual([]);
  });
});
