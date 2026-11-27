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

  // tdd-review finding: `ressourcen.woche` (apps/web/src/abfragen/schluessel.ts:98) queries
  // `/api/v1/dienstplan/woche?standortId=...&tag=YYYY-MM-DD`, but `wocheDaten` in demoApi.ts:148-149
  // reads `query.get("jahr")` and `query.get("woche")` instead of `tag`, always returning KW 48.
  test("GET /api/v1/dienstplan/woche honors the tag query parameter", async () => {
    const antwort = await demoAntwort<{
      tage: string[];
      kw: { jahr: number; nummer: number };
    }>("/api/v1/dienstplan/woche?standortId=st1&tag=2026-12-07");
    expect(antwort.ok).toBe(true);
    if (antwort.ok) {
      expect(antwort.daten.tage).toContain("2026-12-07");
      expect(antwort.daten.kw).toEqual({ jahr: 2026, nummer: 50 });
    }
  });

  // tdd-review finding: `demoApi.ts:107,125` introduces unlocalized German umlaut strings
  // ("Frühschicht", "Spätschicht") which fail CI `bunx checks` i18n check.
  test("demoApi.ts contains no unlocalized German umlaut strings flagged by checks i18n", () => {
    const inhalt = readFileSync(resolve(import.meta.dirname, "demoApi.ts"), "utf-8");
    const umlautZeilen = inhalt
      .split("\n")
      .map((zeile, index) => ({ zeile: index + 1, text: zeile }))
      .filter(({ text }) => /[äöüßÄÖÜ]/.test(text));
    expect(umlautZeilen).toEqual([]);
  });

  test("GET /api/v1/personen/:id/angaben returns valid Angaben shape without crashing AngabenDialog", async () => {
    const antwort = await demoAntwort<{
      geburtsdatum: string | null;
      wechselschicht: boolean;
      abruf: boolean;
      mutterschutz: unknown[];
    }>("/api/v1/personen/jonas/angaben");
    expect(antwort.ok).toBe(true);
    if (antwort.ok) {
      expect(Array.isArray(antwort.daten.mutterschutz)).toBe(true);
      expect(typeof antwort.daten.wechselschicht).toBe("boolean");
      expect(typeof antwort.daten.abruf).toBe("boolean");
    }
  });

  // tdd-review finding: `demoApi.ts` does not handle `PUT /api/v1/personen/:id/angaben` in
  // `schreiben()`, so saving in `AngabenDialog` returns `{ ok: true }` and the invalidated
  // `GET /api/v1/personen/:id/angaben` immediately resets the form to empty defaults.
  test("PUT /api/v1/personen/:id/angaben persists and returns the saved Angaben", async () => {
    const gespeichert = {
      geburtsdatum: "2009-06-01",
      wechselschicht: true,
      abruf: false,
      mutterschutz: [{ von: "2026-11-01", bis: null }],
    };
    const put = await demoAntwort<typeof gespeichert>("/api/v1/personen/jonas/angaben", {
      method: "PUT",
      body: gespeichert,
    });
    expect(put.ok).toBe(true);
    if (put.ok) expect(put.daten).toEqual(gespeichert);

    const get = await demoAntwort<typeof gespeichert>("/api/v1/personen/jonas/angaben");
    expect(get.ok).toBe(true);
    if (get.ok) expect(get.daten).toEqual(gespeichert);
  });

  // tdd-review finding: `demoApi.ts` does not handle `POST` / `DELETE /api/v1/dienstplan/kalender`
  // in `schreiben()`. `KalenderDialog` expects `{ abo: { angelegtAm, sprache }, url: string }` on
  // POST and passes `url` to `webcalVon(url)` (`url.replace(...)`), crashing with TypeError when
  // `{ ok: true }` is returned.
  test("POST and DELETE /api/v1/dienstplan/kalender issue and revoke a calendar feed link", async () => {
    const post = await demoAntwort<{
      abo?: { angelegtAm: number; sprache: string };
      url?: string;
    }>("/api/v1/dienstplan/kalender", {
      method: "POST",
      body: { sprache: "de" },
    });
    expect(post.ok).toBe(true);
    if (post.ok) {
      expect(typeof post.daten.url).toBe("string");
      expect(post.daten.url).toMatch(/^https?:\/\/.+\.ics$/);
      expect(typeof post.daten.abo?.angelegtAm).toBe("number");
    }

    const aktiv = await demoAntwort<{ abo: { angelegtAm: number } | null }>(
      "/api/v1/dienstplan/kalender",
    );
    expect(aktiv.ok).toBe(true);
    if (aktiv.ok) expect(aktiv.daten.abo).not.toBeNull();

    const del = await demoAntwort("/api/v1/dienstplan/kalender", { method: "DELETE" });
    expect(del.ok).toBe(true);

    const nachher = await demoAntwort<{ abo: unknown }>("/api/v1/dienstplan/kalender");
    expect(nachher.ok).toBe(true);
    if (nachher.ok) expect(nachher.daten.abo).toBeNull();
  });
});
