import { describe, expect, it } from "vitest";
import { betriebMitTerminal, gekoppelt, json, neuerServer } from "./terminal-testhilfen.ts";

/** Café Elbblick and Weber Haustechnik, each with a terminal and a person with PIN 4711 */
const zwei = async () => {
  const server = neuerServer();
  const elbblick = await betriebMitTerminal(server);
  const weber = await betriebMitTerminal(server, "Weber Haustechnik", "weber", "sandra");
  const geraetElbblick = await gekoppelt(server, elbblick.inhaber);
  const geraetWeber = await gekoppelt(server, weber.inhaber, "Werkstatt");
  return { server, elbblick, weber, geraetElbblick, geraetWeber };
};

describe("no business sees or changes another's terminals", { timeout: 20_000 }, () => {
  it("GET /api/v1/terminal/geraete lists one's own terminals only", async () => {
    const { elbblick, geraetElbblick } = await zwei();
    const liste = await json(await elbblick.inhaber.anfrage("/api/v1/terminal/geraete"));
    expect((liste.terminals as { terminalId: string }[]).map((t) => t.terminalId)).toEqual([
      geraetElbblick.terminalId,
    ]);
  });

  it("DELETE /api/v1/terminal/geraete/:id does not reach another business's terminal", async () => {
    const { elbblick, geraetWeber } = await zwei();
    const antwort = await elbblick.inhaber.anfrage(
      `/api/v1/terminal/geraete/${geraetWeber.terminalId}`,
      { method: "DELETE" },
    );
    expect(antwort.status).toBe(404);
    expect((await geraetWeber.anfrage("/api/v1/kiosk")).status).toBe(200);
  });

  it("POST /api/v1/terminal/geraete pairs into one's own business", async () => {
    const { server, elbblick, weber } = await zwei();
    await elbblick.inhaber.anfrage("/api/v1/terminal/geraete", { body: { name: "Küche" } });
    expect(
      server.sqlite.query("SELECT betrieb_id FROM terminals WHERE name = 'Küche'").all(),
    ).toEqual([{ betrieb_id: elbblick.inhaber.betriebId }]);
    expect(weber.inhaber.betriebId).not.toBe(elbblick.inhaber.betriebId);
  });

  it("GET /api/v1/terminal/personen shows one's own people only", async () => {
    const { elbblick } = await zwei();
    const personen = await json(await elbblick.inhaber.anfrage("/api/v1/terminal/personen"));
    expect((personen.personen as { name: string }[]).map((p) => p.name)).toEqual([
      "Inhaber Café Elbblick",
      "lea",
    ]);
  });

  it("POST and DELETE /api/v1/terminal/ausweise/:id do not reach a person of another business", async () => {
    const { server, elbblick, weber } = await zwei();
    const pfad = `/api/v1/terminal/ausweise/${weber.mitarbeiterin.nutzerId}`;
    expect((await elbblick.inhaber.anfrage(pfad, { body: {} })).status).toBe(404);
    await weber.inhaber.anfrage(pfad, { body: {} });
    expect((await elbblick.inhaber.anfrage(pfad, { method: "DELETE" })).status).toBe(404);
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM ausweise").get()).toEqual({ n: 1 });
  });

  it("POST /api/v1/kiosk/erkennen finds the PIN in the terminal's business only", async () => {
    const { elbblick, weber, geraetElbblick, geraetWeber } = await zwei();
    const hier = await json(
      await geraetElbblick.anfrage("/api/v1/kiosk/erkennen", { body: { pin: "4711" } }),
    );
    const dort = await json(
      await geraetWeber.anfrage("/api/v1/kiosk/erkennen", { body: { pin: "4711" } }),
    );
    expect(hier.person).toMatchObject({ nutzerId: elbblick.mitarbeiterin.nutzerId });
    expect(dort.person).toMatchObject({ nutzerId: weber.mitarbeiterin.nutzerId });
  });

  it("POST /api/v1/kiosk/erkennen does not take another business's QR code", async () => {
    const { weber, geraetElbblick } = await zwei();
    const { wert } = await json(
      await weber.inhaber.anfrage(`/api/v1/terminal/ausweise/${weber.mitarbeiterin.nutzerId}`, {
        body: {},
      }),
    );
    const antwort = await geraetElbblick.anfrage("/api/v1/kiosk/erkennen", { body: { qr: wert } });
    expect(antwort.status).toBe(401);
  });

  it("POST /api/v1/kiosk/stempeln writes into the terminal's business only", async () => {
    const { server, weber, geraetWeber } = await zwei();
    await geraetWeber.anfrage("/api/v1/kiosk/stempeln", {
      body: { ausweis: { pin: "4711" }, art: "kommen" },
    });
    expect(server.sqlite.query("SELECT betrieb_id, nutzer_id FROM stempelungen").all()).toEqual([
      { betrieb_id: weber.inhaber.betriebId, nutzer_id: weber.mitarbeiterin.nutzerId },
    ]);
  });

  it("GET /api/v1/kiosk names the terminal's own business", async () => {
    const { geraetWeber } = await zwei();
    expect(await json(await geraetWeber.anfrage("/api/v1/kiosk"))).toMatchObject({
      betrieb: "Weber Haustechnik",
      name: "Werkstatt",
    });
  });

  it("POST /api/v1/kiosk/koppeln pairs into the code's business", async () => {
    const { server, weber, geraetWeber } = await zwei();
    expect(
      server.sqlite
        .query("SELECT betrieb_id FROM terminals WHERE terminal_id = ?")
        .get(geraetWeber.terminalId),
    ).toEqual({ betrieb_id: weber.inhaber.betriebId });
  });
});
