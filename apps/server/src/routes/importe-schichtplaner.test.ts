import { ELBBLICK } from "@soll/import/fixtures";
import { describe, expect, it } from "vitest";
import { crewmeisterErsatz } from "../crewmeister-ersatz.ts";
import { kettePruefen } from "../modules/audit/index.ts";
import { papershiftErsatz } from "../papershift-ersatz.ts";
import { plandayErsatz } from "../planday-ersatz.ts";
import { testServer } from "../test-server.ts";
import { elbblick, json } from "./dienstplan-testhilfen.ts";
import { IMP, JETZT } from "./importe-testhilfen.ts";

/*
 * The imports from Papershift, Planday and Crewmeister through the API (BAULISTE.md S-706): the
 * fetch against the stand-ins built after each tool's sources, then preview, dry run and takeover
 * of the file it became; shifts into the plan as drafts, stamps, absences; a second fetch creates
 * nothing; a closed month takes nothing; the access is in no answer, file or log.
 */

const PAPERSHIFT = { token: "ps-geheim-4711" };
const PLANDAY = { appId: "app-17", token: "pd-refresh-geheim" };
const CREWMEISTER = { email: "mia@elbblick.test", passwort: "cm-geheim" };

const elbblickMitSchichtplanern = async () => {
  const ersatz = {
    papershift: papershiftErsatz({ ...PAPERSHIFT, daten: ELBBLICK.papershift, seitengroesse: 2 }),
    planday: plandayErsatz({
      ...PLANDAY,
      daten: { ...ELBBLICK.planday, deactivated: [] },
      seitengroesse: 2,
    }),
    crewmeister: crewmeisterErsatz({ ...CREWMEISTER, daten: ELBBLICK.crewmeister }),
  };
  const log: string[] = [];
  const server = testServer({
    log: (zeile) => log.push(zeile),
    schichtplanerFetch: (anfrage) => {
      const host = new URL(anfrage.url).hostname;
      const ziel = host.includes("papershift")
        ? ersatz.papershift
        : host.includes("planday")
          ? ersatz.planday
          : ersatz.crewmeister;
      return ziel.fetch(anfrage);
    },
  });
  const e = await elbblick(server);
  server.stelleUhr(JETZT);
  const yusuf = await server.eingeladen(e.mia, "mitarbeiter", "yusuf");
  return { ...e, yusuf, ersatz, log };
};
type E = Awaited<ReturnType<typeof elbblickMitSchichtplanern>>;

const abrufen = async (e: E, quelle: string, zugang: object, bis = "2026-09-30") => {
  const antwort = await e.mia.anfrage(`${IMP}/abruf`, {
    body: { quelle, zugang, von: "2026-09-01", bis },
  });
  expect(antwort.status).toBe(200);
  return (await json(antwort)).datei as { name: string; inhalt: string };
};

const zuordnung = (e: E, standort: string | null = e.standortId) => ({
  personen: {
    "Tom Becker": e.tom.nutzerId,
    "Lea Wolf": e.lea.nutzerId,
    "Yusuf Demir": e.yusuf.nutzerId,
    "Olena Koval": null,
  },
  arten: {
    Urlaub: "urlaub",
    Krankheit: "krank",
    Krank: "krank",
    Vacation: "urlaub",
    Absence: "krank",
  },
  kunden: {},
  projekte: {},
  taetigkeiten: {},
  standort,
});

const koerper = (
  quelle: string,
  datei: unknown,
  z: object,
  abgeschlossenBis: string | null = null,
) => ({
  quelle,
  datei,
  spalten: {},
  zuordnung: z,
  abgeschlossenBis,
});

const zaehlen = (e: E, tabelle: string, quelle: string) =>
  (
    e.server.sqlite
      .query(`SELECT count(*) AS n FROM ${tabelle} WHERE betrieb_id = ? AND extern_quelle = ?`)
      .get(e.mia.betriebId, quelle) as { n: number }
  ).n;

describe("the import from Crewmeister (S-706)", () => {
  it("fetches, previews and takes shifts, stamps and absences over; a second run creates nothing", async () => {
    const e = await elbblickMitSchichtplanern();
    const datei = await abrufen(e, "crewmeister", CREWMEISTER);
    expect(datei.name).toBe("crewmeister-2026-09-01-2026-09-30.jsonl");
    const text = Buffer.from(datei.inhalt, "base64").toString("utf8");
    for (const verboten of ["cm-geheim", "@elbblick", "Grippe", "Elbchaussee"])
      expect(text).not.toContain(verboten);
    const vorschau = await json(
      await e.mia.anfrage(`${IMP}/vorschau`, {
        body: { quelle: "crewmeister", datei, spalten: {} },
      }),
    );
    expect(vorschau.anzahl).toMatchObject({ zeiten: 4, schichten: 3, abwesenheiten: 3 });
    const probe = await json(
      await e.mia.anfrage(`${IMP}/probelauf`, {
        body: koerper("crewmeister", datei, zuordnung(e)),
      }),
    );
    expect(probe.zahlen).toMatchObject({
      zeiten: { neu: 4, abgelehnt: 0 },
      schichten: { neu: 3, abgelehnt: 0 },
      abwesenheiten: { neu: 3, abgelehnt: 0 },
    });
    const erster = await e.mia.anfrage(IMP, { body: koerper("crewmeister", datei, zuordnung(e)) });
    expect(erster.status).toBe(201);
    const schichten = e.server.sqlite
      .query(
        "SELECT standort_id, nutzer_id, rolle, veroeffentlicht_am, tag FROM schichten WHERE betrieb_id = ? ORDER BY beginn",
      )
      .all(e.mia.betriebId) as Record<string, unknown>[];
    expect(schichten).toEqual([
      {
        standort_id: e.standortId,
        nutzer_id: e.tom.nutzerId,
        rolle: "Küche",
        veroeffentlicht_am: null,
        tag: "2026-09-01",
      },
      {
        standort_id: e.standortId,
        nutzer_id: e.lea.nutzerId,
        rolle: "Service",
        veroeffentlicht_am: null,
        tag: "2026-09-04",
      },
      {
        standort_id: e.standortId,
        nutzer_id: null,
        rolle: "Service",
        veroeffentlicht_am: null,
        tag: "2026-09-06",
      },
    ]);
    const halb = e.server.sqlite
      .query("SELECT erster_halb FROM abwesenheiten WHERE betrieb_id = ? AND extern_id = '6003'")
      .get(e.mia.betriebId) as { erster_halb: number };
    expect(halb.erster_halb).toBe(1);
    expect(zaehlen(e, "stempelungen", "crewmeister")).toBe(8);
    const zweiter = await json(
      await e.mia.anfrage(IMP, {
        body: koerper("crewmeister", await abrufen(e, "crewmeister", CREWMEISTER), zuordnung(e)),
      }),
    );
    expect(zweiter.zahlen).toMatchObject({
      zeiten: { neu: 0, vorhanden: 4 },
      schichten: { neu: 0, vorhanden: 3 },
      abwesenheiten: { neu: 0, vorhanden: 3 },
    });
    expect(zaehlen(e, "schichten", "crewmeister")).toBe(3);
    expect(kettePruefen(e.server.db, e.mia.betriebId)).toEqual([]);
    expect(e.log.join("\n")).not.toContain("cm-geheim");
  });

  it("refuses shifts without the module, leaves them out without a site, and a site of another business", async () => {
    const e = await elbblickMitSchichtplanern();
    const datei = await abrufen(e, "crewmeister", CREWMEISTER);
    const ohneOrt = await json(
      await e.mia.anfrage(`${IMP}/probelauf`, {
        body: koerper("crewmeister", datei, zuordnung(e, null)),
      }),
    );
    expect(ohneOrt.zahlen).toMatchObject({ schichten: { neu: 0, ausgelassen: 3 } });
    const fremd = await e.server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const fremderOrt = await json(
      await fremd.anfrage("/api/v1/standorte", { body: { name: "Hafen", land: "HH" } }),
    );
    const falsch = await e.mia.anfrage(`${IMP}/probelauf`, {
      body: koerper("crewmeister", datei, zuordnung(e, fremderOrt.standortId as string)),
    });
    expect(falsch.status).toBe(422);
    expect(await json(falsch)).toEqual({ fehler: "standort_unbekannt" });
    await e.mia.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: false } });
    const aus = await json(
      await e.mia.anfrage(`${IMP}/probelauf`, {
        body: koerper("crewmeister", datei, zuordnung(e)),
      }),
    );
    expect(aus.zahlen).toMatchObject({ schichten: { abgelehnt: 3 }, zeiten: { neu: 4 } });
  });

  it("names a wrong password and keeps it out of every answer", async () => {
    const e = await elbblickMitSchichtplanern();
    const antwort = await e.mia.anfrage(`${IMP}/abruf`, {
      body: {
        quelle: "crewmeister",
        zugang: { ...CREWMEISTER, passwort: "falsch-geheim" },
        von: "2026-09-01",
        bis: "2026-09-30",
      },
    });
    expect(antwort.status).toBe(422);
    expect(await antwort.text()).toBe('{"fehler":"zugang_abgelehnt"}');
  });

  it("lets the period reach 92 days ahead for the coming plan, no further", async () => {
    const e = await elbblickMitSchichtplanern();
    const zeitraum = async (bis: string) =>
      (
        await e.mia.anfrage(`${IMP}/abruf`, {
          body: { quelle: "crewmeister", zugang: CREWMEISTER, von: "2026-11-01", bis },
        })
      ).status;
    expect(await zeitraum("2027-02-25")).toBe(200);
    expect(await zeitraum("2027-02-26")).toBe(422);
  });
});

describe("the imports from Planday and Papershift (S-706)", () => {
  it("take times, shifts and absences over the same way; a closed month takes nothing", async () => {
    const e = await elbblickMitSchichtplanern();
    const planday = await abrufen(e, "planday", PLANDAY, "2026-10-31");
    const erster = await json(
      await e.mia.anfrage(IMP, { body: koerper("planday", planday, zuordnung(e), "2026-09") }),
    );
    expect(erster.zahlen).toMatchObject({
      zeiten: { neu: 2 },
      schichten: { neu: 3 },
      abwesenheiten: { neu: 2 },
    });
    expect(erster.gesperrt).toEqual(
      expect.arrayContaining([{ nutzerId: e.tom.nutzerId, monat: "2026-09" }]),
    );
    // Tom's September is closed now: Papershift's times of it are refused, not written
    const papershift = await abrufen(e, "papershift", PAPERSHIFT);
    expect(Buffer.from(papershift.inhalt, "base64").toString("utf8")).not.toContain("ps-geheim");
    const zweiter = await json(
      await e.mia.anfrage(`${IMP}/probelauf`, {
        body: koerper("papershift", papershift, zuordnung(e)),
      }),
    );
    const gruende = (zweiter.abgelehnt as { liste: { grund: string }[] }).liste.map((a) => a.grund);
    expect(gruende).toContain("monat_abgeschlossen");
    expect(zweiter.zahlen).toMatchObject({ schichten: { neu: 0, vorhanden: 0 } });
    expect(e.log.join("\n")).not.toMatch(/ps-geheim|pd-refresh-geheim/);
  });
});
