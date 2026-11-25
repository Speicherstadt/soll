import { describe, expect, it } from "vitest";
import { offlineTablet } from "./terminal-offline-testhilfen.ts";
import { betriebMitTerminal, gekoppelt, json, neuerServer } from "./terminal-testhilfen.ts";

/**
 * Café Elbblick (Lea) and Weber Haustechnik (Sandra), each with a paired tablet whose key is
 * registered; both people have the PIN 471100
 */
const zwei = async () => {
  const server = neuerServer();
  const elbblick = await betriebMitTerminal(server);
  const weber = await betriebMitTerminal(server, "Weber Haustechnik", "weber", "sandra");
  const geraetElbblick = await gekoppelt(server, elbblick.inhaber);
  const geraetWeber = await gekoppelt(server, weber.inhaber, "Werkstatt");
  const paarWeber = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
    "verify",
  ]);
  const offlineElbblick = await offlineTablet(geraetElbblick);
  const offlineWeber = await offlineTablet(geraetWeber, paarWeber);
  await offlineElbblick.anmelden();
  await offlineWeber.anmelden();
  const stempelVon = () =>
    server.sqlite
      .query("SELECT betrieb_id, nutzer_id, terminal_id FROM stempelungen")
      .all() as Record<string, string>[];
  return {
    server,
    elbblick,
    weber,
    geraetElbblick,
    geraetWeber,
    paarWeber,
    offlineElbblick,
    offlineWeber,
    stempelVon,
  };
};

describe("no business sees or changes another's offline queue (S-803)", { timeout: 20_000 }, () => {
  it("PUT /api/v1/kiosk/schluessel sets the key of the tablet's own terminal only", async () => {
    const { server, elbblick, geraetElbblick, geraetWeber } = await zwei();
    const zeilen = server.sqlite
      .query("SELECT betrieb_id, terminal_id, schluessel IS NOT NULL AS mit FROM terminals")
      .all();
    expect(zeilen).toEqual(
      expect.arrayContaining([
        { betrieb_id: elbblick.inhaber.betriebId, terminal_id: geraetElbblick.terminalId, mit: 1 },
        expect.objectContaining({ terminal_id: geraetWeber.terminalId, mit: 1 }),
      ]),
    );
    const schluessel = server.sqlite
      .query("SELECT schluessel FROM terminals ORDER BY terminal_id")
      .all() as { schluessel: string }[];
    expect(new Set(schluessel.map((z) => z.schluessel)).size).toBe(2);
  });

  it("POST /api/v1/kiosk/offline stamps a person of the tablet's own business only", async () => {
    const { elbblick, weber, geraetWeber, offlineWeber, stempelVon } = await zwei();
    expect((await offlineWeber.stempeln({ nummer: 1, ausweis: { pin: "471100" } })).status).toBe(
      201,
    );
    expect(stempelVon()).toEqual([
      {
        betrieb_id: weber.inhaber.betriebId,
        nutzer_id: weber.mitarbeiterin.nutzerId,
        terminal_id: geraetWeber.terminalId,
      },
    ]);
    expect(elbblick.mitarbeiterin.nutzerId).not.toBe(weber.mitarbeiterin.nutzerId);
  });

  it("POST /api/v1/kiosk/offline refuses an entry signed by another business's tablet", async () => {
    const { offlineElbblick, paarWeber, stempelVon } = await zwei();
    const fremd = await offlineElbblick.eintrag(
      { nummer: 1, ausweis: { pin: "471100" } },
      paarWeber,
    );
    const antwort = await offlineElbblick.senden(fremd);
    expect(antwort.status).toBe(422);
    expect(await json(antwort)).toEqual({ fehler: "signatur" });
    expect(stempelVon()).toEqual([]);
  });

  it("POST /api/v1/kiosk/offline does not open a credential taken at another business's tablet", async () => {
    const { geraetWeber, offlineElbblick, stempelVon } = await zwei();
    const antwort = await offlineElbblick.stempeln({
      nummer: 1,
      ausweis: { pin: "471100" },
      fuer: geraetWeber.terminalId,
    });
    expect(await json(antwort)).toEqual({ fehler: "ausweis_unlesbar" });
    expect(stempelVon()).toEqual([]);
  });

  it("GET /api/v1/terminal/geraete shows the refusals and gaps of one's own terminals only", async () => {
    const { elbblick, weber, offlineWeber } = await zwei();
    await offlineWeber.stempeln({ nummer: 2, ausweis: { pin: "000000" } });
    const eigene = await json(await weber.inhaber.anfrage("/api/v1/terminal/geraete"));
    expect(eigene.terminals).toMatchObject([
      {
        offline: {
          luecken: [{ von: 1, bis: 1 }],
          abgelehnt: [{ nummer: 2, grund: "ausweis_unbekannt" }],
        },
      },
    ]);
    const andere = await json(await elbblick.inhaber.anfrage("/api/v1/terminal/geraete"));
    expect(andere.terminals).toMatchObject([{ offline: { luecken: [], abgelehnt: [] } }]);
  });
});
