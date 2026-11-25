import { TABELLE_VORLAGE_CSV, tabelleVorlageXlsx, xlsxSchreiben, type Zelle } from "@soll/import";
import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { IMP, weberZumUmzug } from "./importe-testhilfen.ts";
import { anlegen, json, mitProjektzeit } from "./projektzeit-testhilfen.ts";

/*
 * A spreadsheet of times with free columns through the API (BAULISTE.md S-702): an Excel workbook
 * read on the server, the columns chosen by the owner, projects and activities as bookings, and a
 * second run with the lines moved and one added that creates only that one.
 */

const KOPF: Zelle[] = ["Wer", "Tag", "Von", "Bis", "Pause (min)", "Baustelle", "Leistung"].map(
  (text) => ({ text }),
);

const zeile = (
  person: string,
  tag: string,
  beginn: number,
  ende: number,
  pause: number,
): Zelle[] => [
  { text: person },
  { tag },
  { minuten: beginn },
  { minuten: ende },
  { zahl: pause },
  { text: "Bad Elbhof" },
  { text: "Montage" },
];

const SANDRA_1 = zeile("Sandra", "2026-09-01", 7 * 60, 15 * 60 + 30, 30);
const SANDRA_2 = zeile("Sandra", "2026-09-02", 7 * 60, 12 * 60, 0);
const MAX_1 = zeile("Max Brandt", "2026-09-01", 8 * 60, 16 * 60, 30);

const datei = (zeilen: Zelle[][], name = "stunden.xlsx") => ({
  name,
  inhalt: Buffer.from(xlsxSchreiben("Stunden", [KOPF, ...zeilen])).toString("base64"),
});

/** The columns of the file chosen by the owner: no header of it is one Soll knows */
const SPALTEN = {
  person: "Wer",
  datum: "Tag",
  beginn: "Von",
  ende: "Bis",
  pause: "Pause (min)",
  projekt: "Baustelle",
  taetigkeit: "Leistung",
};

/** Weber with the order Bad Elbhof and the activity Montage */
const weberMitMontage = async () => {
  const w = await weberZumUmzug();
  const kunde = await anlegen(w.weber, "/kunden", { name: "Elbhof", nummer: "K-1001" });
  const projekt = await anlegen(w.weber, "/projekte", {
    kundeId: kunde.kundeId,
    name: "Bad Elbhof",
  });
  const taetigkeit = await anlegen(w.weber, "/taetigkeiten", { name: "Montage" });
  return {
    ...w,
    projektId: projekt.projektId as string,
    taetigkeitId: taetigkeit.taetigkeitId as string,
  };
};

type W = Awaited<ReturnType<typeof weberMitMontage>>;

const koerper = (w: W, zeilen: Zelle[][], buchung?: unknown) => ({
  quelle: "tabelle",
  datei: datei(zeilen),
  spalten: SPALTEN,
  zuordnung: {
    personen: { Sandra: w.sandra.nutzerId, "Max Brandt": w.max.nutzerId },
    arten: {},
    kunden: {},
    projekte: {},
    buchung: buchung ?? {
      projekte: { "Bad Elbhof": w.projektId },
      taetigkeiten: { Montage: w.taetigkeitId },
    },
  },
  abgeschlossenBis: null,
});

const buchungenIn = (w: W) =>
  w.server.sqlite
    .query(
      "SELECT nutzer_id AS nutzerId, projekt_id AS projektId, taetigkeit_id AS taetigkeitId, extern_quelle AS quelle, import_id AS importId FROM projektzeiten WHERE betrieb_id = ? ORDER BY beginn",
    )
    .all(w.weber.betriebId) as Record<string, string>[];

describe("a spreadsheet of times with free columns (S-702)", () => {
  it("previews an Excel workbook with the columns chosen and proposes order and activity", async () => {
    const w = await weberMitMontage();
    const antwort = await w.weber.anfrage(`${IMP}/vorschau`, {
      body: { quelle: "tabelle", datei: datei([SANDRA_1, MAX_1]), spalten: SPALTEN },
    });
    expect(antwort.status).toBe(200);
    const vorschau = await json(antwort);
    expect(vorschau.lesefehler).toEqual({ anzahl: 0, liste: [] });
    expect(vorschau.anzahl).toMatchObject({ zeiten: 2 });
    expect(vorschau.kopf).toEqual(KOPF.map((k) => (k as { text: string }).text));
    expect(vorschau.buchung).toMatchObject({
      projekte: [{ wert: "Bad Elbhof", datensaetze: 2, vorschlag: w.projektId }],
      taetigkeiten: [{ wert: "Montage", datensaetze: 2, vorschlag: w.taetigkeitId }],
    });
    // without the choice Tag, Von and Bis are proposed, "Wer" is not: the reader names the column
    const ohne = await json(
      await w.weber.anfrage(`${IMP}/vorschau`, {
        body: { quelle: "tabelle", datei: datei([SANDRA_1]), spalten: {} },
      }),
    );
    expect((ohne.lesefehler as { liste: unknown[] }).liste).toEqual([
      { zeile: 1, grund: "spalte_fehlt", feld: "person" },
    ]);
  });

  it("takes times and bookings over, and a second run of a longer file creates only what is new", async () => {
    const w = await weberMitMontage();
    const erster = await json(await w.weber.anfrage(IMP, { body: koerper(w, [SANDRA_1, MAX_1]) }));
    expect(erster.zahlen).toMatchObject({
      zeiten: { neu: 2, vorhanden: 0, abgelehnt: 0 },
      buchungen: { neu: 2, vorhanden: 0, abgelehnt: 0 },
    });
    // a break in the middle makes two bookings per time
    expect(buchungenIn(w)).toHaveLength(4);
    expect(buchungenIn(w)[0]).toEqual({
      nutzerId: w.sandra.nutzerId,
      projektId: w.projektId,
      taetigkeitId: w.taetigkeitId,
      quelle: "tabelle",
      importId: erster.importId,
    });
    const zweiter = await json(
      await w.weber.anfrage(IMP, { body: koerper(w, [MAX_1, SANDRA_2, SANDRA_1]) }),
    );
    expect(zweiter.zahlen).toMatchObject({
      zeiten: { neu: 1, vorhanden: 2, abgelehnt: 0 },
      buchungen: { neu: 1, vorhanden: 2, abgelehnt: 0 },
    });
    expect(buchungenIn(w)).toHaveLength(5);
    expect(kettePruefen(w.server.db, w.weber.betriebId)).toEqual([]);
    // Sandra's information (Art. 15 DSGVO) names import, tool and id of each booking taken over
    const auskunft = await json(await w.sandra.anfrage("/api/v1/auskunft"));
    const projektzeit = auskunft.projektzeiten as { uebernommen?: Record<string, unknown> }[];
    expect(projektzeit[0]?.uebernommen).toEqual({
      importId: erster.importId,
      quelle: "tabelle",
      kennung: expect.stringMatching(/^inhalt-[0-9a-f]{64}\/buchung\/1$/),
    });
  });

  it("takes the time without a booking when the project is left out", async () => {
    const w = await weberMitMontage();
    const ergebnis = await json(
      await w.weber.anfrage(IMP, {
        body: koerper(w, [SANDRA_1], { projekte: { "Bad Elbhof": null }, taetigkeiten: {} }),
      }),
    );
    expect(ergebnis.zahlen).toMatchObject({ zeiten: { neu: 1 }, buchungen: { ausgelassen: 1 } });
    expect(buchungenIn(w)).toEqual([]);
  });

  it("refuses a column for a field the tool does not read, and an order or activity of another business", async () => {
    const w = await weberMitMontage();
    const falsch = await w.weber.anfrage(`${IMP}/vorschau`, {
      body: { quelle: "tabelle", datei: datei([SANDRA_1]), spalten: { typ: "Wer" } },
    });
    expect(falsch.status).toBe(422);
    expect(await json(falsch)).toEqual({ fehler: "spalte_unbekannt" });

    const mia = await mitProjektzeit(w.server, "Café Elbblick", "elbblick");
    const kunde = await anlegen(mia, "/kunden", { name: "Hafen" });
    const fremdesProjekt = await anlegen(mia, "/projekte", { kundeId: kunde.kundeId, name: "Bar" });
    const fremdeTaetigkeit = await anlegen(mia, "/taetigkeiten", { name: "Service" });
    for (const [buchung, fehler] of [
      [
        { projekte: { "Bad Elbhof": fremdesProjekt.projektId }, taetigkeiten: {} },
        "projekt_unbekannt",
      ],
      [
        { projekte: {}, taetigkeiten: { Montage: fremdeTaetigkeit.taetigkeitId } },
        "taetigkeit_unbekannt",
      ],
    ] as const)
      for (const pfad of [IMP, `${IMP}/probelauf`]) {
        const antwort = await w.weber.anfrage(pfad, { body: koerper(w, [SANDRA_1], buchung) });
        expect(antwort.status).toBe(422);
        expect(await json(antwort)).toEqual({ fehler });
      }
    expect(buchungenIn(w)).toEqual([]);
  });

  it("refuses an archived order as the target of a booking", async () => {
    const w = await weberMitMontage();
    const archiv = await w.weber.anfrage(`/api/v1/projektzeit/projekte/${w.projektId}`, {
      method: "PATCH",
      body: { archiviert: true },
    });
    expect(archiv.status).toBe(200);
    const antwort = await w.weber.anfrage(`${IMP}/probelauf`, { body: koerper(w, [SANDRA_1]) });
    expect(antwort.status).toBe(422);
    expect(await json(antwort)).toEqual({ fehler: "projekt_unbekannt" });
  });
});

describe("the templates of a spreadsheet of times (S-702)", () => {
  it("hands the owner the CSV and the Excel template, the same bytes each time", async () => {
    const { weber, sandra } = await weberZumUmzug();
    const xlsx = await weber.anfrage(`${IMP}/vorlagen/soll-zeiten.xlsx`);
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(new Uint8Array(await xlsx.arrayBuffer())).toEqual(tabelleVorlageXlsx());
    const csv = await weber.anfrage(`${IMP}/vorlagen/soll-zeiten.csv`);
    expect(await csv.text()).toBe(TABELLE_VORLAGE_CSV.replace(/^﻿/, ""));
    expect((await weber.anfrage(`${IMP}/vorlagen/passwd`)).status).toBe(404);
    for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"])
      expect((await weber.anfrage(`${IMP}/vorlagen/${name}`)).status).toBe(404);
    expect((await sandra.anfrage(`${IMP}/vorlagen/soll-zeiten.xlsx`)).status).toBe(403);
  });
});
