import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import {
  betriebMitTerminal,
  gekoppelt,
  JETZT,
  json,
  neuerServer,
  pinSetzen,
} from "./terminal-testhilfen.ts";

const qrAusstellen = async (
  inhaber: { anfrage: (pfad: string, init?: { body?: unknown }) => Promise<Response> },
  nutzerId: string,
) =>
  String(
    (await json(await inhaber.anfrage(`/api/v1/terminal/ausweise/${nutzerId}`, { body: {} }))).wert,
  );

// Each PIN set is an Argon2id hash with Bun's default cost (as in anmeldung.test.ts)
describe("recognising a person at the terminal (S-801)", { timeout: 20_000 }, () => {
  it("finds the person by the PIN alone and shows their day", async () => {
    const server = neuerServer();
    const { inhaber, mitarbeiterin } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const antwort = await geraet.anfrage("/api/v1/kiosk/erkennen", { body: { pin: "4711" } });
    expect(antwort.status).toBe(200);
    const daten = await json(antwort);
    expect(daten.person).toEqual({ nutzerId: mitarbeiterin.nutzerId, name: "lea" });
    expect(daten.tag).toMatchObject({ tag: "2026-11-20", stand: { zustand: "aus" } });
  });

  it("stamps for the person with the source terminal and the device", async () => {
    const server = neuerServer();
    const { inhaber, mitarbeiterin } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const antwort = await geraet.anfrage("/api/v1/kiosk/stempeln", {
      body: { ausweis: { pin: "4711" }, art: "kommen", geraetZeitpunkt: JETZT - 2000 },
    });
    expect(antwort.status).toBe(201);
    const daten = await json(antwort);
    expect(daten.stempel).toMatchObject({ art: "kommen", zeitpunkt: JETZT, quelle: "terminal" });
    expect(daten.tag).toMatchObject({ stand: { zustand: "arbeit" } });
    expect(
      server.sqlite
        .query(
          "SELECT nutzer_id, quelle, terminal_id, erstellt_von, geraet_zeitpunkt FROM stempelungen",
        )
        .all(),
    ).toEqual([
      {
        nutzer_id: mitarbeiterin.nutzerId,
        quelle: "terminal",
        terminal_id: geraet.terminalId,
        erstellt_von: mitarbeiterin.nutzerId,
        geraet_zeitpunkt: JETZT - 2000,
      },
    ]);
    const tag = await json(await mitarbeiterin.anfrage("/api/v1/arbeitszeit/tag"));
    expect(tag.stempelungen).toMatchObject([{ art: "kommen", quelle: "terminal" }]);
    expect(kettePruefen(server.db, inhaber.betriebId)).toEqual([]);
  });

  it("refuses a wrong PIN without stamping", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const antwort = await geraet.anfrage("/api/v1/kiosk/stempeln", {
      body: { ausweis: { pin: "0000" }, art: "kommen" },
    });
    expect(antwort.status).toBe(401);
    expect(await json(antwort)).toEqual({ fehler: "unbekannt", rest: 4 });
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM stempelungen").get()).toEqual({ n: 0 });
  });

  it("locks the terminal after five wrong tries, longer each time", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const versuch = (pin: string) => geraet.anfrage("/api/v1/kiosk/erkennen", { body: { pin } });
    for (let i = 1; i <= 4; i++) expect((await versuch("0000")).status).toBe(401);
    const fuenfter = await versuch("0000");
    expect(fuenfter.status).toBe(423);
    expect(await json(fuenfter)).toEqual({ fehler: "gesperrt", gesperrtBis: JETZT + 60_000 });
    // locked: even the right PIN is not compared
    expect((await versuch("4711")).status).toBe(423);
    expect((await json(await geraet.anfrage("/api/v1/kiosk"))).gesperrtBis).toBe(JETZT + 60_000);
    server.stelleUhr(JETZT + 60_000);
    for (let i = 1; i <= 4; i++) await versuch("0000");
    expect(await json(await versuch("0000"))).toEqual({
      fehler: "gesperrt",
      gesperrtBis: JETZT + 60_000 + 120_000,
    });
    server.stelleUhr(JETZT + 180_000);
    expect((await versuch("4711")).status).toBe(200);
    // a person recognised starts the count afresh
    expect(await json(await versuch("0000"))).toEqual({ fehler: "unbekannt", rest: 4 });
    const glieder = server.sqlite
      .query("SELECT COUNT(*) AS n FROM audit_glieder WHERE tabelle = 'terminals' AND akteur = ?")
      .get(`terminal:${geraet.terminalId}`) as { n: number };
    expect(glieder.n).toBeGreaterThanOrEqual(12);
    expect(kettePruefen(server.db, inhaber.betriebId)).toEqual([]);
  });

  it("refuses a PIN another member of the business holds", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const tom = await server.eingeladen(inhaber, "mitarbeiter", "tom");
    const doppelt = await pinSetzen(inhaber, tom.nutzerId, "4711");
    expect(doppelt.status).toBe(409);
    expect(await json(doppelt)).toEqual({ fehler: "pin_vergeben" });
    expect((await pinSetzen(inhaber, tom.nutzerId, "2468")).status).toBe(204);
  });

  it("never stores a PIN as it is", async () => {
    const server = neuerServer();
    await betriebMitTerminal(server);
    const roh = JSON.stringify([
      server.sqlite.query("SELECT * FROM pins").all(),
      server.sqlite.query("SELECT inhalt FROM audit_inhalte").all(),
    ]);
    expect(roh).not.toContain("4711");
  });

  it("recognises nobody who left the business or does not stamp", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const extern = await server.eingeladen(inhaber, "extern", "olena");
    await pinSetzen(inhaber, extern.nutzerId, "1357");
    const geraet = await gekoppelt(server, inhaber);
    expect((await geraet.anfrage("/api/v1/kiosk/erkennen", { body: { pin: "1357" } })).status).toBe(
      401,
    );
  });

  it("refuses recognising and stamping while the module Arbeitszeit is off", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    // the module can only go off without employees: the owner alone stamps nothing here
    server.sqlite.query("UPDATE betriebe SET modul_arbeitszeit = 0").run();
    const antwort = await geraet.anfrage("/api/v1/kiosk/erkennen", { body: { pin: "4711" } });
    expect(antwort.status).toBe(403);
    expect(await json(antwort)).toEqual({ fehler: "modul_aus", modul: "arbeitszeit" });
  });
});

describe("the QR code of a person", { timeout: 20_000 }, () => {
  it("recognises the person, until a new one replaces it", async () => {
    const server = neuerServer();
    const { inhaber, mitarbeiterin } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const erster = await qrAusstellen(inhaber, mitarbeiterin.nutzerId);
    expect(erster).toMatch(/^soll-ausweis:[\w-]{43}$/);
    const erkennen = (qr: string) => geraet.anfrage("/api/v1/kiosk/erkennen", { body: { qr } });
    expect((await json(await erkennen(erster))).person).toMatchObject({ name: "lea" });
    const zweiter = await qrAusstellen(inhaber, mitarbeiterin.nutzerId);
    expect((await erkennen(erster)).status).toBe(401);
    expect((await erkennen(zweiter)).status).toBe(200);
    const personen = await json(await inhaber.anfrage("/api/v1/terminal/personen"));
    // the owner stamps too (S-304), without PIN or QR code so far
    expect(personen.personen).toEqual([
      { nutzerId: inhaber.nutzerId, name: "Inhaber Café Elbblick", pin: false, ausweis: false },
      { nutzerId: mitarbeiterin.nutzerId, name: "lea", pin: true, ausweis: true },
    ]);
    expect(JSON.stringify(server.sqlite.query("SELECT * FROM ausweise").all())).not.toContain(
      zweiter.split(":")[1],
    );
  });

  it("recognises nobody once revoked", async () => {
    const server = neuerServer();
    const { inhaber, mitarbeiterin } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const wert = await qrAusstellen(inhaber, mitarbeiterin.nutzerId);
    const weg = await inhaber.anfrage(`/api/v1/terminal/ausweise/${mitarbeiterin.nutzerId}`, {
      method: "DELETE",
    });
    expect(weg.status).toBe(204);
    expect((await geraet.anfrage("/api/v1/kiosk/erkennen", { body: { qr: wert } })).status).toBe(
      401,
    );
    const nochmal = await inhaber.anfrage(`/api/v1/terminal/ausweise/${mitarbeiterin.nutzerId}`, {
      method: "DELETE",
    });
    expect(nochmal.status).toBe(404);
  });

  it("stamps a break with the QR code", async () => {
    const server = neuerServer();
    const { inhaber, mitarbeiterin } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const qr = await qrAusstellen(inhaber, mitarbeiterin.nutzerId);
    await geraet.anfrage("/api/v1/kiosk/stempeln", { body: { ausweis: { qr }, art: "kommen" } });
    server.stelleUhr(JETZT + 4 * 3_600_000);
    const pause = await json(
      await geraet.anfrage("/api/v1/kiosk/stempeln", {
        body: { ausweis: { qr }, art: "pause_beginn" },
      }),
    );
    expect(pause.tag).toMatchObject({ stand: { zustand: "pause" } });
  });
});
