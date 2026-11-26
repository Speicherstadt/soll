import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { demoAntwort } from "./demoApi.ts";

describe("demoApi", () => {
  test("returns demo business and records a clock-in", async () => {
    const betrieb = await demoAntwort<{ betriebId: string; name: string }>("/api/v1/betrieb");
    expect(betrieb.ok).toBe(true);
    if (betrieb.ok) expect(betrieb.daten.name).toBe("Weber Haustechnik");

    const stempel = await demoAntwort<{ ok: boolean }>("/api/v1/arbeitszeit/stempel", {
      method: "POST",
      body: { art: "gehen" },
    });
    expect(stempel.ok).toBe(true);
  });

  // tdd-review finding: `bunx checks` (CI `check` job) fails with:
  // `apps/web/src/demo/demoDaten.ts:137  text in the code: Bäder Elbhof, 3. OG`
  test("demoDaten.ts contains no unlocalized German umlaut strings flagged by checks i18n", () => {
    const inhalt = readFileSync(resolve(import.meta.dirname, "demoDaten.ts"), "utf-8");
    const umlautZeilen = inhalt
      .split("\n")
      .map((zeile, index) => ({ zeile: index + 1, text: zeile }))
      .filter(({ text }) => /[äöüßÄÖÜ]/.test(text));
    expect(umlautZeilen).toEqual([]);
  });

  // tdd-review finding: `heuteStempeln` (apps/web/src/zeiten/heute.ts) posts to
  // `/api/v1/arbeitszeit/stempelungen`, whereas demoApi.ts only handles `/api/v1/arbeitszeit/stempel`.
  test("POST /api/v1/arbeitszeit/stempelungen appends a stamp to GET /api/v1/arbeitszeit/tag", async () => {
    const vorher = await demoAntwort<{ stempelungen: unknown[] }>("/api/v1/arbeitszeit/tag");
    expect(vorher.ok).toBe(true);
    const anzahlVorher = vorher.ok ? vorher.daten.stempelungen.length : 0;

    const stempel = await demoAntwort<{ ok: boolean }>("/api/v1/arbeitszeit/stempelungen", {
      method: "POST",
      body: { art: "pause_anfang", geraetZeitpunkt: Date.now() },
    });
    expect(stempel.ok).toBe(true);

    const nachher = await demoAntwort<{ stempelungen: unknown[] }>("/api/v1/arbeitszeit/tag");
    expect(nachher.ok).toBe(true);
    if (nachher.ok) expect(nachher.daten.stempelungen.length).toBe(anzahlVorher + 1);
  });

  // tdd-review finding: `GET /api/v1/projektzeit/auslastung` returns flat fields instead of
  // `TeamAntwort` (`{ monat, jePersonSeit, team: { art: "team", ... } }`), causing `teamZustand`
  // in apps/web/src/auslastung/zustand.ts to return `{ art: "fehler" }`.
  test("GET /api/v1/projektzeit/auslastung matches TeamAntwort shape", async () => {
    const antwort = await demoAntwort<{
      monat: string;
      jePersonSeit: number | null;
      team?: { art: string; anwesendMinuten: number; abrechenbarMinuten: number };
    }>("/api/v1/projektzeit/auslastung?monat=2026-10");
    expect(antwort.ok).toBe(true);
    if (antwort.ok) {
      expect(antwort.daten.team).toBeDefined();
      expect(antwort.daten.team?.art).toBe("team");
      expect(typeof antwort.daten.team?.anwesendMinuten).toBe("number");
    }
  });

  // tdd-review finding: `GET /api/v1/arbeitszeit/erinnerungen` returns `geraetAktiv`, `inhaber`
  // and `regeln: { ausstempeln, monat }` instead of `ErinnerungAnsicht`
  // (`vapidSchluessel`, `mail`, `geraete`, `regeln: { gehenMinuten, pauseVorlauf, monatTag }`).
  test("GET /api/v1/arbeitszeit/erinnerungen matches ErinnerungAnsicht shape", async () => {
    const antwort = await demoAntwort<{
      vapidSchluessel?: string;
      mail?: boolean;
      geraete?: number;
      regeln: { gehenMinuten?: number; pauseVorlauf?: number; monatTag?: number };
    }>("/api/v1/arbeitszeit/erinnerungen");
    expect(antwort.ok).toBe(true);
    if (antwort.ok) {
      expect(typeof antwort.daten.vapidSchluessel).toBe("string");
      expect(typeof antwort.daten.mail).toBe("boolean");
      expect(typeof antwort.daten.geraete).toBe("number");
      expect(typeof antwort.daten.regeln.gehenMinuten).toBe("number");
      expect(typeof antwort.daten.regeln.pauseVorlauf).toBe("number");
      expect(typeof antwort.daten.regeln.monatTag).toBe("number");
    }
  });

  // tdd-review finding: `GET /api/v1/arbeitszeit/datev` returns `beraternummer`/`mandantennummer`
  // and omits `postenarten` instead of `DatevAnsicht` (`beraterNr`, `mandantenNr`, `postenarten`).
  test("GET /api/v1/arbeitszeit/datev matches DatevAnsicht shape", async () => {
    const antwort = await demoAntwort<{
      beraterNr?: string | null;
      mandantenNr?: string | null;
      postenarten?: string[];
    }>("/api/v1/arbeitszeit/datev");
    expect(antwort.ok).toBe(true);
    if (antwort.ok) {
      expect(antwort.daten).toHaveProperty("beraterNr");
      expect(antwort.daten).toHaveProperty("mandantenNr");
      expect(Array.isArray(antwort.daten.postenarten)).toBe(true);
    }
  });

  test("GET /api/v1/projektzeit/stundennachweise/vorschau matches Vorschau shape", async () => {
    const antwort = await demoAntwort<{
      kunde: { name: string; nummer: string };
      auftrag: { name: string; nummer: string };
      zeilen: unknown[];
      summeMinuten: number;
      stand: string;
    }>("/api/v1/projektzeit/stundennachweise/vorschau?projektId=p1&von=2026-11-26&bis=2026-11-26");
    expect(antwort.ok).toBe(true);
    if (antwort.ok) {
      expect(Array.isArray(antwort.daten.zeilen)).toBe(true);
      expect(typeof antwort.daten.summeMinuten).toBe("number");
      expect(typeof antwort.daten.kunde.name).toBe("string");
      expect(typeof antwort.daten.auftrag.name).toBe("string");
    }
  });
});
