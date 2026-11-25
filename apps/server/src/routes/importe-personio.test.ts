import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { personioErsatz, WEBER_IN_PERSONIO } from "../personio-ersatz.ts";
import { IMP, weberZumUmzug } from "./importe-testhilfen.ts";
import { json } from "./projektzeit-testhilfen.ts";

/*
 * The import from Personio through its API v2 (BAULISTE.md S-704): the fetch against the stand-in
 * built after Personio's descriptions (credentials-service-api-v2, persons-service-api-v2, the v2
 * clients for periods), then preview, dry run and takeover of the file it became; a second fetch
 * creates nothing; the credentials are in no answer, file or log, and the token is revoked.
 */

const ID = "papi-c0ffee00-1111-4222-8333-444455556666";
const SECRET = "papi-verY-Secret-p4ssw0rd";

const weberMitPersonio = async (optionen: Partial<Parameters<typeof personioErsatz>[0]> = {}) => {
  const ersatz = personioErsatz({
    clientId: ID,
    clientSecret: SECRET,
    daten: WEBER_IN_PERSONIO,
    seitengroesse: 2,
    ...optionen,
  });
  const log: string[] = [];
  const w = await weberZumUmzug({ personioFetch: ersatz.fetch, log: (zeile) => log.push(zeile) });
  return { ...w, ersatz, log };
};
type W = Awaited<ReturnType<typeof weberMitPersonio>>;

const abrufKoerper = (aenderung: Record<string, unknown> = {}) => ({
  quelle: "personio",
  zugang: { clientId: ID, clientSecret: SECRET },
  von: "2026-09-01",
  bis: "2026-09-30",
  ...aenderung,
});

const abrufen = async (w: W) => {
  const antwort = await w.weber.anfrage(`${IMP}/abruf`, { body: abrufKoerper() });
  expect(antwort.status).toBe(200);
  return (await json(antwort)).datei as { name: string; inhalt: string };
};

const uebernahme = (w: W, datei: unknown, abgeschlossenBis: string | null = null) => ({
  quelle: "personio",
  datei,
  spalten: {},
  zuordnung: {
    personen: {
      "Sandra Kühn": w.sandra.nutzerId,
      "Max Brandt": w.max.nutzerId,
      "Jonas Weber": null,
    },
    arten: { Urlaub: "urlaub", Krankheit: "krank" },
    kunden: {},
    projekte: {},
    taetigkeiten: {},
  },
  abgeschlossenBis,
});

const abwesenheiten = (w: W) =>
  w.server.sqlite
    .query(
      `SELECT art, von, bis, erster_halb AS ersterHalb, letzter_halb AS letzterHalb, status
       FROM abwesenheiten WHERE betrieb_id = ? AND extern_quelle = 'personio' ORDER BY von`,
    )
    .all(w.weber.betriebId);

const zaehlen = (w: W) =>
  (
    w.server.sqlite
      .query(
        "SELECT count(*) AS n FROM stempelungen WHERE betrieb_id = ? AND extern_quelle = 'personio'",
      )
      .get(w.weber.betriebId) as { n: number }
  ).n;

describe("the import from Personio (S-704)", () => {
  it("fetches a file without credentials, e-mails or comments, page by page, and revokes the token", async () => {
    const w = await weberMitPersonio();
    const datei = await abrufen(w);
    expect(datei.name).toBe("personio-2026-09-01-2026-09-30.jsonl");
    const text = Buffer.from(datei.inhalt, "base64").toString("utf8");
    for (const verboten of [ID, SECRET, "papi-", "@weber", "IBAN", "Bandscheibe", "Tor 3"])
      expect(text).not.toContain(verboten);
    const token = w.ersatz.anfragen[0];
    expect(token?.methode).toBe("POST");
    expect(new URLSearchParams(token?.koerper).get("grant_type")).toBe("client_credentials");
    const listen = w.ersatz.anfragen.filter((a) => a.methode === "GET");
    // pages of two: 3 persons, 3 types, 7 periods of September, 4 absences
    expect(listen.map((a) => a.pfad)).toEqual([
      ...Array(2).fill("/v2/persons"),
      ...Array(2).fill("/v2/absence-types"),
      ...Array(4).fill("/v2/attendance-periods"),
      ...Array(2).fill("/v2/absence-periods"),
    ]);
    expect(listen[4]?.abfrage.get("start.date_time.gte")).toBe("2026-09-01T00:00:00");
    expect(w.ersatz.anfragen.at(-1)?.pfad).toBe("/v2/auth/revoke");
    expect(w.ersatz.offeneTokens()).toBe(0);

    const vorschau = await json(
      await w.weber.anfrage(`${IMP}/vorschau`, {
        body: { quelle: "personio", datei, spalten: {} },
      }),
    );
    expect(vorschau.anzahl).toMatchObject({ zeiten: 5, abwesenheiten: 3 });
    expect(vorschau.arten).toEqual([
      { art: "Krankheit", datensaetze: 1, vorschlag: "krank" },
      { art: "Urlaub", datensaetze: 2, vorschlag: "urlaub" },
    ]);
    const lesefehler = vorschau.lesefehler as { liste: { grund: string }[] };
    expect(lesefehler.liste.map((f) => f.grund)).toEqual([
      "laeuft_noch",
      "nicht_genehmigt",
      "teil_tag",
    ]);
  });

  it("takes times and absences in half days over; a second fetch creates nothing", async () => {
    const w = await weberMitPersonio();
    const erster = await w.weber.anfrage(IMP, { body: uebernahme(w, await abrufen(w)) });
    expect(erster.status).toBe(201);
    expect((await json(erster)).zahlen).toMatchObject({
      zeiten: { neu: 5, abgelehnt: 0 },
      abwesenheiten: { neu: 3, abgelehnt: 0 },
    });
    expect(zaehlen(w)).toBe(10);
    expect(abwesenheiten(w)).toEqual([
      {
        art: "urlaub",
        von: "2026-09-14",
        bis: "2026-09-18",
        ersterHalb: 0,
        letzterHalb: 0,
        status: "genehmigt",
      },
      {
        art: "krank",
        von: "2026-09-21",
        bis: "2026-09-22",
        ersterHalb: 0,
        letzterHalb: 1,
        status: "genehmigt",
      },
      {
        art: "urlaub",
        von: "2026-09-25",
        bis: "2026-09-25",
        ersterHalb: 1,
        letzterHalb: 0,
        status: "genehmigt",
      },
    ]);
    // sickness keeps neither reason nor comment (Art. 9 DSGVO)
    const zeile = w.server.sqlite
      .query("SELECT grund, bescheinigung FROM abwesenheiten WHERE art = 'krank'")
      .get();
    expect(zeile).toEqual({ grund: null, bescheinigung: null });

    const zweiter = await json(
      await w.weber.anfrage(IMP, { body: uebernahme(w, await abrufen(w)) }),
    );
    expect(zweiter.zahlen).toMatchObject({
      zeiten: { neu: 0, vorhanden: 5 },
      abwesenheiten: { neu: 0, vorhanden: 3 },
    });
    expect(zaehlen(w)).toBe(10);
    expect(kettePruefen(w.server.db, w.weber.betriebId)).toEqual([]);
    for (const geheim of [ID, SECRET, "papi-"]) expect(w.log.join("\n")).not.toContain(geheim);
  });

  it("closes the months Personio had closed, and a later fetch changes none of them", async () => {
    const daten = structuredClone(WEBER_IN_PERSONIO);
    const w = await weberMitPersonio({ daten });
    const erster = await json(
      await w.weber.anfrage(IMP, { body: uebernahme(w, await abrufen(w), "2026-09") }),
    );
    expect(erster.gesperrt).toHaveLength(2);
    // a period entered in Personio afterwards, in the closed September
    daten.attendancePeriods.push({
      id: "a1b2c3d4-0000-4000-8000-000000000099",
      person: { id: "1002" },
      type: "WORK",
      start: { date_time: "2026-09-08T07:00:00" },
      end: { date_time: "2026-09-08T12:00:00" },
      approval: { status: "CONFIRMED" },
    });
    const zweiter = await json(
      await w.weber.anfrage(IMP, { body: uebernahme(w, await abrufen(w)) }),
    );
    expect((zweiter.abgelehnt as { liste: unknown[] }).liste).toEqual([
      expect.objectContaining({
        art: "zeiten",
        externalId: "a1b2c3d4-0000-4000-8000-000000000099",
        grund: "monat_abgeschlossen",
      }),
    ]);
    expect(zweiter.zahlen).toMatchObject({ zeiten: { neu: 0, vorhanden: 5, abgelehnt: 1 } });
  });

  it("answers failures as values, without the credentials", async () => {
    const w = await weberMitPersonio({ rechte: ["persons"] });
    const faelle: [Record<string, unknown>, number, string][] = [
      [{}, 422, "rechte_fehlen"],
      [{ zugang: { clientId: ID, clientSecret: "falsch" } }, 422, "zugang_abgelehnt"],
      [{ von: "2026-11-01", bis: "2026-12-31" }, 422, "zeitraum"],
    ];
    for (const [aenderung, status, fehler] of faelle) {
      const antwort = await w.weber.anfrage(`${IMP}/abruf`, { body: abrufKoerper(aenderung) });
      expect(antwort.status).toBe(status);
      const text = await antwort.text();
      expect(JSON.parse(text)).toEqual({ fehler });
      expect(text).not.toContain(SECRET);
    }
    // a refused fetch revokes its token too
    expect(w.ersatz.offeneTokens()).toBe(0);
    expect(w.log.join("\n")).not.toContain(SECRET);
  });

  it("refuses a next link to another origin or to the same page, a redirect and a broken body", async () => {
    const w = await weberMitPersonio();
    const faelle: [Parameters<W["ersatz"]["stoeren"]>[0], number, Record<string, unknown>][] = [
      ["fremd", 502, { fehler: "antwort_ungueltig" }],
      ["schleife", 502, { fehler: "antwort_ungueltig" }],
      ["weiter", 502, { fehler: "weiterleitung" }],
      ["kaputt", 502, { fehler: "antwort_ungueltig" }],
      [500, 502, { fehler: "nicht_erreichbar" }],
      [429, 429, { fehler: "zu_viele_anfragen", wiederholenNach: 60 }],
      [401, 422, { fehler: "zugang_abgelehnt" }],
    ];
    for (const [stoerung, status, antwortKoerper] of faelle) {
      w.ersatz.stoeren(stoerung);
      const antwort = await w.weber.anfrage(`${IMP}/abruf`, { body: abrufKoerper() });
      expect(antwort.status).toBe(status);
      expect(await json(antwort)).toEqual(antwortKoerper);
    }
    const fremd = w.ersatz.anfragen.filter((a) => a.pfad.startsWith("https"));
    expect(fremd).toEqual([]);
  });

  it("lets only the owner fetch and refuses unknown fields", async () => {
    const w = await weberMitPersonio();
    for (const person of [w.sandra, w.anna])
      expect((await person.anfrage(`${IMP}/abruf`, { body: abrufKoerper() })).status).toBe(403);
    expect(w.ersatz.anfragen).toEqual([]);
    const falsch = await w.weber.anfrage(`${IMP}/abruf`, {
      body: abrufKoerper({ zugang: { clientId: ID, clientSecret: SECRET, token: "x" } }),
    });
    expect(falsch.status).toBe(400);
  });
});
