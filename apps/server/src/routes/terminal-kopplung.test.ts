import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import {
  betriebMitTerminal,
  gekoppelt,
  JETZT,
  json,
  kopplungscode,
  neuerServer,
  tablet,
} from "./terminal-testhilfen.ts";

describe("pairing a terminal (S-801)", () => {
  it("trades a code of the owner once for a device token", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const { code, gueltigBis, terminalId } = await kopplungscode(inhaber);
    expect(code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(gueltigBis).toBe(JETZT + 10 * 60_000);
    const geschrieben = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`;
    const erst = await tablet(server).anfrage("/api/v1/kiosk/koppeln", {
      body: { code: geschrieben },
    });
    expect(erst.status).toBe(201);
    const daten = await json(erst);
    expect(daten).toMatchObject({ terminalId, name: "Eingang", betrieb: "Café Elbblick" });
    const zweit = await tablet(server).anfrage("/api/v1/kiosk/koppeln", { body: { code } });
    expect(zweit.status).toBe(404);
    const stand = await json(await tablet(server, String(daten.token)).anfrage("/api/v1/kiosk"));
    expect(stand).toEqual({
      terminalId,
      name: "Eingang",
      betrieb: "Café Elbblick",
      gesperrtBis: null,
    });
    expect(kettePruefen(server.db, inhaber.betriebId)).toEqual([]);
  });

  it("keeps code and token only as hashes", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const { code } = await kopplungscode(inhaber);
    const roh = JSON.stringify(server.sqlite.query("SELECT * FROM terminals").all());
    expect(roh).not.toContain(code);
    const antwort = await json(
      await tablet(server).anfrage("/api/v1/kiosk/koppeln", { body: { code } }),
    );
    const danach = JSON.stringify([
      server.sqlite.query("SELECT * FROM terminals").all(),
      server.sqlite.query("SELECT inhalt FROM audit_inhalte").all(),
    ]);
    expect(danach).not.toContain(String(antwort.token));
  });

  it("refuses a code after ten minutes", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const { code } = await kopplungscode(inhaber);
    server.stelleUhr(JETZT + 10 * 60_000);
    const antwort = await tablet(server).anfrage("/api/v1/kiosk/koppeln", { body: { code } });
    expect(antwort.status).toBe(404);
    expect(await json(antwort)).toEqual({ fehler: "code_ungueltig" });
  });

  it("refuses a revoked terminal at once and lists it no more", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const liste = await json(await inhaber.anfrage("/api/v1/terminal/geraete"));
    expect(liste.terminals).toEqual([
      {
        terminalId: geraet.terminalId,
        name: "Eingang",
        gekoppeltAm: JETZT,
        kopplungBis: null,
        gesperrtBis: null,
      },
    ]);
    const weg = await inhaber.anfrage(`/api/v1/terminal/geraete/${geraet.terminalId}`, {
      method: "DELETE",
    });
    expect(weg.status).toBe(204);
    const danach = await geraet.anfrage("/api/v1/kiosk");
    expect(danach.status).toBe(401);
    expect(await json(danach)).toEqual({ fehler: "terminal_unbekannt" });
    expect((await json(await inhaber.anfrage("/api/v1/terminal/geraete"))).terminals).toEqual([]);
  });

  it("revokes an open pairing code too", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const { code, terminalId } = await kopplungscode(inhaber);
    await inhaber.anfrage(`/api/v1/terminal/geraete/${terminalId}`, { method: "DELETE" });
    const antwort = await tablet(server).anfrage("/api/v1/kiosk/koppeln", { body: { code } });
    expect(antwort.status).toBe(404);
  });

  it("refuses an unknown or missing device token", async () => {
    const server = neuerServer();
    await betriebMitTerminal(server);
    expect((await tablet(server).anfrage("/api/v1/kiosk")).status).toBe(401);
    expect((await tablet(server, "falsch").anfrage("/api/v1/kiosk")).status).toBe(401);
  });

  it("lets only the owner manage terminals", async () => {
    const server = neuerServer();
    const { inhaber, mitarbeiterin } = await betriebMitTerminal(server);
    const planer = await server.eingeladen(inhaber, "planer", "tom");
    for (const person of [mitarbeiterin, planer]) {
      expect(
        (await person.anfrage("/api/v1/terminal/geraete", { body: { name: "x" } })).status,
      ).toBe(403);
      expect((await person.anfrage("/api/v1/terminal/geraete")).status).toBe(403);
      expect((await person.anfrage("/api/v1/terminal/personen")).status).toBe(403);
    }
  });

  it("gives a device token no other route of the API", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    for (const pfad of ["/api/v1/betrieb", "/api/v1/arbeitszeit/tag", "/api/v1/terminal/geraete"])
      expect((await geraet.anfrage(pfad)).status, pfad).toBe(401);
  });
});

describe("the module Terminal switched off", () => {
  it("refuses pairing, the tablet and the owner's routes", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const { code } = await kopplungscode(inhaber, "Lager");
    await inhaber.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { terminal: false } });
    const koppeln = await tablet(server).anfrage("/api/v1/kiosk/koppeln", { body: { code } });
    expect(koppeln.status).toBe(403);
    expect(await json(koppeln)).toEqual({ fehler: "modul_aus", modul: "terminal" });
    for (const antwort of [
      await geraet.anfrage("/api/v1/kiosk"),
      await geraet.anfrage("/api/v1/kiosk/erkennen", { body: { pin: "471100" } }),
      await geraet.anfrage("/api/v1/kiosk/stempeln", {
        body: { ausweis: { pin: "471100" }, art: "kommen" },
      }),
      await inhaber.anfrage("/api/v1/terminal/geraete"),
      await inhaber.anfrage("/api/v1/terminal/personen"),
    ])
      expect(antwort.status).toBe(403);
  });
});
