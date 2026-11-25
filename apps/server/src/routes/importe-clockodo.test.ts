import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clockodoErsatz, WEBER_IN_CLOCKODO } from "../clockodo-ersatz.ts";
import { datei, IMP, uebernehmen as nehmen, weberZumUmzug } from "./importe-testhilfen.ts";
import { PZ } from "./projektzeit-testhilfen.ts";

/*
 * The import from Clockodo over its API (S-703), against a stand-in built after the public SDK
 * `clockodo` (apps/server/src/clockodo-ersatz.ts): the fetch with its headers and pages, the file
 * it becomes, the takeover through the same steps as a file, and an access that stays nowhere.
 */

const NUTZER = "jonas@weber-haustechnik.test";
const SCHLUESSEL = "ck-geheim-4711-schluessel";
const ZUGANG = { nutzer: NUTZER, schluessel: SCHLUESSEL };
const SEPTEMBER = { quelle: "clockodo", zugang: ZUGANG, von: "2026-09-01", bis: "2026-09-30" };

const mitClockodo = async () => {
  const ersatz = clockodoErsatz({
    nutzer: NUTZER,
    schluessel: SCHLUESSEL,
    daten: WEBER_IN_CLOCKODO,
    seitengroesse: 2,
  });
  const zeilen: string[] = [];
  const umzug = await weberZumUmzug({ clockodoFetch: ersatz.fetch, log: (z) => zeilen.push(z) });
  return { ...umzug, ersatz, zeilen };
};

type Umzug = Awaited<ReturnType<typeof mitClockodo>>;

type Anzahl = { neu: number; vorhanden: number; ausgelassen: number; abgelehnt: number };
/** The answers of the API as far as these tests read them */
type Antwort = {
  datei: { name: string; inhalt: string };
  anzahl: Record<string, number>;
  lesefehler: { liste: unknown[] };
  arten: { vorschlag: string }[];
  zahlen: Record<string, Anzahl>;
  dateiSha256: string;
  taetigkeiten: { name: string; fest: boolean; externQuelle: string; externId: string }[];
};
const json = async (antwort: Response) => (await antwort.json()) as Antwort;
const uebernehmen = async (person: Umzug["weber"], body: unknown) =>
  (await nehmen(person, body)) as unknown as Antwort;

const abrufen = async (u: Umzug, body: unknown = SEPTEMBER) =>
  u.weber.anfrage(`${IMP}/abruf`, { body });

/** Jonas (the owner) and Sandra as in Clockodo, every kind of absence Soll proposes */
const zuordnung = (u: Umzug) => ({
  personen: { "Jonas Weber": u.weber.nutzerId, "Sandra Kühn": u.sandra.nutzerId },
  arten: { "Regular holiday": "urlaub", "Sick day": "krank" },
  kunden: {},
  projekte: {},
  taetigkeiten: {},
});

const uebernahmeKoerper = (u: Umzug, d: { name: string; inhalt: string }) => ({
  quelle: "clockodo",
  datei: d,
  spalten: {},
  zuordnung: zuordnung(u),
  abgeschlossenBis: null,
});

describe("the fetch from Clockodo's API (S-703)", () => {
  it("fetches every page with the headers of the SDK and answers with a file", async () => {
    const u = await mitClockodo();
    const antwort = await abrufen(u);
    expect(antwort.status).toBe(200);
    const { datei: abzug } = await json(antwort);
    expect(abzug.name).toBe("clockodo-2026-09-01-2026-09-30.jsonl");
    const text = Buffer.from(abzug.inhalt, "base64").toString("utf8");
    expect(text.split("\n")[0]).toContain('"format":"soll-clockodo-api"');
    // pages one after the other, two records each
    expect(u.ersatz.anfragen.map((a) => `${a.pfad}${a.abfrage}`)).toEqual([
      "/api/v3/users?page=1",
      "/api/v3/customers?page=1",
      "/api/v4/projects?page=1",
      "/api/v4/services?page=1",
      "/api/v2/entries?time_since=2026-08-31T22%3A00%3A00Z&time_until=2026-09-30T22%3A00%3A00Z&page=1",
      "/api/v2/entries?time_since=2026-08-31T22%3A00%3A00Z&time_until=2026-09-30T22%3A00%3A00Z&page=2",
      "/api/v2/entries?time_since=2026-08-31T22%3A00%3A00Z&time_until=2026-09-30T22%3A00%3A00Z&page=3",
      "/api/v4/absences?filter%5Byear%5D%5B%5D=2026&page=1",
    ]);
    expect(u.ersatz.anfragen[0]?.kopf).toMatchObject({
      "x-clockodoapiuser": NUTZER,
      "x-clockodoapikey": SCHLUESSEL,
      "x-clockodo-external-application": `Soll;${NUTZER}`,
      "x-clockodoenableisoutcdatetimes": "1",
    });
    // no note, sick note or e-mail of Clockodo in the file
    for (const wort of ["Ostsee", "sick_note", "weber-haustechnik.test", "Rohre"])
      expect(text).not.toContain(wort);
  });

  it("takes the fetch over like a file, and a second fetch creates nothing twice", async () => {
    const u = await mitClockodo();
    const erste = (await json(await abrufen(u))).datei;
    const vorschau = await json(
      await u.weber.anfrage(`${IMP}/vorschau`, {
        body: { quelle: "clockodo", datei: erste, spalten: {} },
      }),
    );
    expect(vorschau.anzahl).toEqual({
      zeiten: 4,
      abwesenheiten: 2,
      kunden: 2,
      projekte: 1,
      taetigkeiten: 2,
      buchungen: 0,
      salden: 0,
      schichten: 0,
    });
    expect(vorschau.lesefehler.liste).toEqual([
      { zeile: expect.any(Number), grund: "nicht_genehmigt", feld: "status" },
    ]);
    expect(vorschau.arten.map((a: { vorschlag: string }) => a.vorschlag)).toEqual([
      "urlaub",
      "krank",
    ]);
    const erster = await uebernehmen(u.weber, uebernahmeKoerper(u, erste));
    expect(erster.zahlen.zeiten).toEqual({ neu: 4, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 });
    expect(erster.zahlen.taetigkeiten).toEqual({
      neu: 2,
      vorhanden: 0,
      ausgelassen: 0,
      abgelehnt: 0,
    });

    const zweite = (await json(await abrufen(u))).datei;
    expect(zweite.inhalt).toBe(erste.inhalt);
    const zweiter = await uebernehmen(u.weber, uebernahmeKoerper(u, zweite));
    for (const art of ["zeiten", "abwesenheiten", "kunden", "projekte", "taetigkeiten"])
      expect(zweiter.zahlen[art]?.neu).toBe(0);
    expect(zweiter.dateiSha256).toBe(erster.dateiSha256);

    const taetigkeiten = await json(await u.weber.anfrage(`${PZ}/taetigkeiten`));
    const eigene = taetigkeiten.taetigkeiten.filter((t: { fest: boolean }) => !t.fest);
    expect(
      eigene.map((t: { name: string; externQuelle: string; externId: string }) => [
        t.name,
        t.externQuelle,
        t.externId,
      ]),
    ).toEqual([
      ["Fahrt", "clockodo", "402"],
      ["Montage", "clockodo", "401"],
    ]);
  });

  it("finds over the CSV backup what the API took over: the same tool and ids", async () => {
    const u = await mitClockodo();
    const abzug = (await json(await abrufen(u))).datei;
    await uebernehmen(u.weber, uebernahmeKoerper(u, abzug));
    const kopf =
      "Id,Co-worker Id,Project Id,Customer Id,Service Id,Begin (UTC),End (UTC),Correction of time in seconds,Lump sum value,Co-worker,Project,Customer,Service";
    const backup = [
      kopf,
      "1001,11,301,201,401,2026-09-01T05:00:00Z,2026-09-01T09:00:00Z,0,,Jonas Weber,Bad Elbhof,Elbhof Immobilien,Montage",
      "1002,11,301,201,402,2026-09-01T09:00:00Z,2026-09-01T13:30:00Z,0,,Jonas Weber,Bad Elbhof,Elbhof Immobilien,Fahrt",
    ].join("\n");
    const probe = await json(
      await u.weber.anfrage(`${IMP}/probelauf`, {
        body: { ...uebernahmeKoerper(u, datei(backup, "backup.csv")) },
      }),
    );
    expect(probe.zahlen.zeiten).toEqual({ neu: 0, vorhanden: 1, ausgelassen: 0, abgelehnt: 0 });
    expect(probe.zahlen.kunden).toEqual({ neu: 0, vorhanden: 1, ausgelassen: 0, abgelehnt: 0 });
    expect(probe.zahlen.taetigkeiten).toEqual({
      neu: 0,
      vorhanden: 2,
      ausgelassen: 0,
      abgelehnt: 0,
    });
  });

  it("keeps the key nowhere: not in an answer, a log line, the database or the file", async () => {
    const u = await mitClockodo();
    const antworten = [await abrufen(u)];
    const abzug = (await json(await abrufen(u))).datei;
    await uebernehmen(u.weber, uebernahmeKoerper(u, abzug));
    u.ersatz.stoeren(401);
    antworten.push(await abrufen(u));
    for (const antwort of antworten) expect(await antwort.text()).not.toContain(SCHLUESSEL);
    expect(u.zeilen.join("\n")).not.toContain(SCHLUESSEL);
    expect(Buffer.from(abzug.inhalt, "base64").toString("utf8")).not.toContain(SCHLUESSEL);
    for (const pfad of [u.server.pfad, `${u.server.pfad}-wal`])
      if (existsSync(pfad)) expect(readFileSync(pfad).includes(SCHLUESSEL)).toBe(false);
  });

  it("answers each refusal of Clockodo with its own reason and status, without a retry", async () => {
    const u = await mitClockodo();
    const fall = async (stoerung: Parameters<Umzug["ersatz"]["stoeren"]>[0]) => {
      u.ersatz.stoeren(stoerung);
      const antwort = await abrufen(u);
      return [antwort.status, await json(antwort)];
    };
    expect(await fall(401)).toEqual([422, { fehler: "zugang_abgelehnt" }]);
    expect(await fall(429)).toEqual([429, { fehler: "zu_viele_anfragen", wiederholenNach: 60 }]);
    expect(await fall(500)).toEqual([502, { fehler: "nicht_erreichbar" }]);
    expect(await fall("netz")).toEqual([502, { fehler: "nicht_erreichbar" }]);
    expect(await fall("kaputt")).toEqual([502, { fehler: "antwort_ungueltig" }]);
    const falsch = await abrufen(u, { ...SEPTEMBER, zugang: { ...ZUGANG, schluessel: "falsch" } });
    expect([falsch.status, await json(falsch)]).toEqual([422, { fehler: "zugang_abgelehnt" }]);
  });

  it("takes a period of at most a year, not in the future, from the owner only", async () => {
    const u = await mitClockodo();
    for (const [von, bis] of [
      ["2026-09-30", "2026-09-01"],
      ["2026-11-01", "2026-11-26"],
      ["2025-09-01", "2026-09-02"],
    ]) {
      const antwort = await abrufen(u, { ...SEPTEMBER, von, bis });
      expect([antwort.status, await json(antwort)]).toEqual([422, { fehler: "zeitraum" }]);
    }
    expect((await abrufen(u, { ...SEPTEMBER, von: "2025-09-02", bis: "2026-09-01" })).status).toBe(
      200,
    );
    expect((await abrufen(u, { ...SEPTEMBER, quelle: "soll-csv" })).status).toBe(400);
    const anna = await u.anna.anfrage(`${IMP}/abruf`, { body: SEPTEMBER });
    expect(anna.status).toBe(403);
    // only the one fetch allowed reached Clockodo: four lists, a page of entries, the absences
    expect(u.ersatz.anfragen.length).toBe(6);
  });
});
