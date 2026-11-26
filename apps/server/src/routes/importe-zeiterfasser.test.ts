import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PETERSEN } from "@soll/import/zeiterfasser-fixtures";
import { describe, expect, it } from "vitest";
import { clockifyErsatz } from "../clockify-ersatz.ts";
import { kettePruefen } from "../modules/audit/index.ts";
import { testServer } from "../test-server.ts";
import { togglErsatz } from "../toggl-ersatz.ts";
import { IMP, JETZT } from "./importe-testhilfen.ts";
import { anlegen, json, mitProjektzeit } from "./projektzeit-testhilfen.ts";

/*
 * Server tests for Toggl Track and Clockify (BAULISTE.md S-707):
 * - API fetch against stand-ins, preview, dry run, takeover in solo mode (arbeitszeit off, projektzeit on)
 * - Cross-way dedup: CSV export and API fetch recognise each other
 * - Error mapping (401/402/403/429), 89-day limit for Toggl, secrets never logged/returned
 * - Tenant isolation and role checks (owner only)
 */

const TOGGL_TOKEN = "toggl_secret_4711";
const CLOCKIFY_KEY = "clockify_secret_4711";

const csvFixture = (name: string) =>
  readFileSync(
    resolve(import.meta.dirname, "../../../../packages/import/src/zeiterfasser/fixtures", name),
    "utf8",
  );

const soloMitZeiterfassern = async (
  togglOpt: Partial<Parameters<typeof togglErsatz>[0]> = {},
  clockifyOpt: Partial<Parameters<typeof clockifyErsatz>[0]> = {},
) => {
  const toggl = togglErsatz({ token: TOGGL_TOKEN, daten: PETERSEN.toggl, ...togglOpt });
  const clockify = clockifyErsatz({
    schluessel: CLOCKIFY_KEY,
    daten: PETERSEN.clockify,
    seitengroesse: 2,
    ...clockifyOpt,
  });
  const log: string[] = [];
  const server = testServer({
    togglFetch: toggl.fetch,
    clockifyFetch: clockify.fetch,
    log: (z) => log.push(z),
  });
  server.stelleUhr(JETZT);
  const solo = await mitProjektzeit(server, "Lina Petersen Design", "lina");
  const mitarbeiter = await server.eingeladen(solo, "mitarbeiter", "helfer");
  const fremd = await mitProjektzeit(server, "Anderer Betrieb", "fremd");
  // Switch off arbeitszeit (solo mode)
  await solo.anfrage("/api/v1/betrieb/module", {
    method: "PATCH",
    body: { arbeitszeit: false },
  });
  return { server, solo, mitarbeiter, fremd, toggl, clockify, log };
};

const zaehlen = (
  server: ReturnType<typeof testServer>,
  betriebId: string,
  tabelle: string,
  quelle: string,
) =>
  (
    server.sqlite
      .query(`SELECT count(*) AS n FROM ${tabelle} WHERE betrieb_id = ? AND extern_quelle = ?`)
      .get(betriebId, quelle) as { n: number }
  ).n;

describe("Toggl Track and Clockify import (S-707)", () => {
  it("fetches Toggl, strips secrets/descriptions, plans kunde_fehlt & internal bookings, and imports in solo mode", async () => {
    const s = await soloMitZeiterfassern();
    const ohneTaetigkeitId = (await anlegen(s.solo, "/taetigkeiten", { name: "Allgemein" }))
      .taetigkeitId as string;

    const abrufRes = await s.solo.anfrage(`${IMP}/abruf`, {
      body: {
        quelle: "toggl",
        zugang: { token: TOGGL_TOKEN },
        von: "2026-09-01",
        bis: "2026-09-30",
      },
    });
    expect(abrufRes.status).toBe(200);
    const datei = (await json(abrufRes)).datei as { name: string; inhalt: string };
    expect(datei.name).toBe("toggl-2026-09-01-2026-09-30.jsonl");
    const text = Buffer.from(datei.inhalt, "base64").toString("utf8");
    for (const verboten of [TOGGL_TOKEN, "lina@petersen-design.test", "Erste Skizzen", "Design"])
      expect(text).not.toContain(verboten);
    expect(s.log.join("\n")).not.toContain(TOGGL_TOKEN);

    const antwort = async (pfad: string, body: unknown) =>
      json(await s.solo.anfrage(pfad, { body })) as Promise<{
        anzahl: Record<string, number>;
        lesefehler: { anzahl: number };
        zahlen: {
          kunden: { neu: number };
          projekte: Record<string, number>;
          buchungen: { neu: number; vorhanden: number; ausgelassen: number; abgelehnt: number };
        };
        abgelehnt: unknown;
      }>;

    const vorschau = await antwort(`${IMP}/vorschau`, {
      quelle: "toggl",
      datei,
      spalten: {},
    });
    expect(vorschau.anzahl).toEqual({
      zeiten: 0,
      abwesenheiten: 0,
      kunden: 4,
      projekte: 5,
      taetigkeiten: 1,
      buchungen: 5,
      salden: 0,
      schichten: 0,
    });
    expect(vorschau.lesefehler.anzahl).toBe(1);

    const uebernahmeBody = {
      quelle: "toggl",
      datei,
      spalten: {},
      zuordnung: {
        personen: { "Lina Petersen": s.solo.nutzerId },
        arten: {},
        kunden: {},
        projekte: {},
        taetigkeiten: {},
        buchung: { projekte: {}, taetigkeiten: { "": ohneTaetigkeitId } },
      },
      abgeschlossenBis: null,
    };

    const probelauf = await antwort(`${IMP}/probelauf`, uebernahmeBody);
    expect(probelauf.zahlen.kunden.neu).toBe(4);
    expect(probelauf.zahlen.projekte).toEqual({
      neu: 4,
      vorhanden: 0,
      ausgelassen: 0,
      abgelehnt: 1,
    });
    expect(probelauf.abgelehnt).toEqual({
      anzahl: 1,
      liste: [
        {
          art: "projekte",
          zeile: 9,
          externalId: JSON.stringify(["", "Akquise"]),
          grund: "kunde_fehlt",
        },
      ],
    });
    // 1 booking on Akquise (left out because Akquise wasn't created), 4 bookings taken over
    expect(probelauf.zahlen.buchungen).toEqual({
      neu: 4,
      vorhanden: 0,
      ausgelassen: 1,
      abgelehnt: 0,
    });

    const ueber = await s.solo.anfrage(IMP, { body: uebernahmeBody });
    expect(ueber.status).toBe(201);
    expect(zaehlen(s.server, s.solo.betriebId, "kunden", "toggl")).toBe(4);
    expect(zaehlen(s.server, s.solo.betriebId, "projekte", "toggl")).toBe(4);
    expect(zaehlen(s.server, s.solo.betriebId, "taetigkeiten", "toggl")).toBe(1);
    expect(zaehlen(s.server, s.solo.betriebId, "projektzeiten", "toggl")).toBe(4);

    // Second run via API creates nothing new
    const zweiter = await antwort(`${IMP}/probelauf`, uebernahmeBody);
    expect(zweiter.zahlen.buchungen.neu).toBe(0);
    expect(zweiter.zahlen.buchungen.vorhanden).toBe(4);

    // CSV export of the same period also recognises all 4 taken-over bookings as already there
    const csvBody = {
      ...uebernahmeBody,
      datei: {
        name: "toggl.csv",
        inhalt: Buffer.from(csvFixture("toggl-detailed.csv"), "utf8").toString("base64"),
      },
    };
    const csvProbe = await antwort(`${IMP}/probelauf`, csvBody);
    expect(csvProbe.zahlen.buchungen.neu).toBe(0);
    expect(csvProbe.zahlen.buchungen.vorhanden).toBe(4);
    expect(kettePruefen(s.server.db, s.solo.betriebId)).toEqual([]);
  });

  it("fetches Clockify with Last-Page paging, strips secrets, and imports", async () => {
    const s = await soloMitZeiterfassern();
    const ohneTaetigkeitId = (await anlegen(s.solo, "/taetigkeiten", { name: "Allgemein" }))
      .taetigkeitId as string;

    const abrufRes = await s.solo.anfrage(`${IMP}/abruf`, {
      body: {
        quelle: "clockify",
        zugang: { schluessel: CLOCKIFY_KEY, region: "eu" },
        von: "2026-09-01",
        bis: "2026-09-30",
      },
    });
    expect(abrufRes.status).toBe(200);
    const datei = (await json(abrufRes)).datei as { name: string; inhalt: string };
    const text = Buffer.from(datei.inhalt, "base64").toString("utf8");
    expect(text).not.toContain(CLOCKIFY_KEY);
    expect(text).not.toContain("lina@petersen-design.test");
    expect(s.log.join("\n")).not.toContain(CLOCKIFY_KEY);

    const ueber = await s.solo.anfrage(IMP, {
      body: {
        quelle: "clockify",
        datei,
        spalten: {},
        zuordnung: {
          personen: { "Lina Petersen": s.solo.nutzerId },
          arten: {},
          kunden: {},
          projekte: { [JSON.stringify(["", "Akquise"])]: "aus" },
          taetigkeiten: {},
          buchung: { projekte: {}, taetigkeiten: { "": ohneTaetigkeitId } },
        },
        abgeschlossenBis: null,
      },
    });
    expect(ueber.status).toBe(201);
    expect(zaehlen(s.server, s.solo.betriebId, "projektzeiten", "clockify")).toBe(4);
  });

  it("maps Toggl and Clockify API errors and enforces Toggl 89-day limit", async () => {
    const s = await soloMitZeiterfassern(
      { kontingent: 0, resetSekunden: 90 },
      { verbotenerSchluessel: "forbidden_key" },
    );
    // Toggl > 89 days back from JETZT (2026-11-25)
    const zuAlt = await s.solo.anfrage(`${IMP}/abruf`, {
      body: {
        quelle: "toggl",
        zugang: { token: TOGGL_TOKEN },
        von: "2026-08-01",
        bis: "2026-08-31",
      },
    });
    expect(zuAlt.status).toBe(422);
    expect((await json(zuAlt)).fehler).toBe("zeitraum");

    // Toggl 403
    const t403 = await s.solo.anfrage(`${IMP}/abruf`, {
      body: {
        quelle: "toggl",
        zugang: { token: "wrong" },
        von: "2026-09-01",
        bis: "2026-09-30",
      },
    });
    expect(t403.status).toBe(422);
    expect((await json(t403)).fehler).toBe("zugang_abgelehnt");

    // Toggl 402 quota
    const t402 = await s.solo.anfrage(`${IMP}/abruf`, {
      body: {
        quelle: "toggl",
        zugang: { token: TOGGL_TOKEN },
        von: "2026-09-01",
        bis: "2026-09-30",
      },
    });
    expect(t402.status).toBe(429);
    expect(await json(t402)).toMatchObject({ fehler: "zu_viele_anfragen", wiederholenNach: 90 });

    // Clockify 401
    const c401 = await s.solo.anfrage(`${IMP}/abruf`, {
      body: {
        quelle: "clockify",
        zugang: { schluessel: "wrong", region: "global" },
        von: "2026-09-01",
        bis: "2026-09-30",
      },
    });
    expect(c401.status).toBe(422);
    expect((await json(c401)).fehler).toBe("zugang_abgelehnt");

    // Clockify 403
    const c403 = await s.solo.anfrage(`${IMP}/abruf`, {
      body: {
        quelle: "clockify",
        zugang: { schluessel: "forbidden_key", region: "global" },
        von: "2026-09-01",
        bis: "2026-09-30",
      },
    });
    expect(c403.status).toBe(422);
    expect((await json(c403)).fehler).toBe("rechte_fehlen");
  });

  it("enforces owner role and tenant isolation across all import routes", async () => {
    const s = await soloMitZeiterfassern();
    const res = await s.mitarbeiter.anfrage(`${IMP}/abruf`, {
      body: {
        quelle: "toggl",
        zugang: { token: TOGGL_TOKEN },
        von: "2026-09-01",
        bis: "2026-09-30",
      },
    });
    expect(res.status).toBe(403);

    const fremdTaetigkeit = (await anlegen(s.fremd, "/taetigkeiten", { name: "Fremd" }))
      .taetigkeitId as string;
    const abrufRes = await s.solo.anfrage(`${IMP}/abruf`, {
      body: {
        quelle: "toggl",
        zugang: { token: TOGGL_TOKEN },
        von: "2026-09-01",
        bis: "2026-09-30",
      },
    });
    const datei = (await json(abrufRes)).datei;
    const probe = await s.solo.anfrage(`${IMP}/probelauf`, {
      body: {
        quelle: "toggl",
        datei,
        spalten: {},
        zuordnung: {
          personen: { "Lina Petersen": s.solo.nutzerId },
          arten: {},
          kunden: {},
          projekte: {},
          taetigkeiten: {},
          buchung: { projekte: {}, taetigkeiten: { "": fremdTaetigkeit } },
        },
        abgeschlossenBis: null,
      },
    });
    expect(probe.status).toBe(422);
  });
});
