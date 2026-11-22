import { describe, expect, it } from "vitest";
import { ntagKarte, sun, UID_KARTE, uidKarte } from "./karten-testhilfen.ts";
import { betriebMitTerminal, gekoppelt, json, neuerServer } from "./terminal-testhilfen.ts";

/** Café Elbblick and Weber Haustechnik, each with a terminal and a person with PIN 471100 */
const zwei = async () => {
  const server = neuerServer();
  const elbblick = await betriebMitTerminal(server);
  const weber = await betriebMitTerminal(server, "Weber Haustechnik", "weber", "sandra");
  const geraetElbblick = await gekoppelt(server, elbblick.inhaber);
  return { server, elbblick, weber, geraetElbblick };
};

describe("no business sees or changes another's cards (S-802)", { timeout: 20_000 }, () => {
  it("GET /api/v1/terminal/karten lists one's own cards only", async () => {
    const { elbblick, weber } = await zwei();
    await uidKarte(weber.inhaber, weber.mitarbeiterin.nutzerId);
    const liste = await json(await elbblick.inhaber.anfrage("/api/v1/terminal/karten"));
    expect(liste.karten).toEqual([]);
  });

  it("POST /api/v1/terminal/karten does not enter a card for a person of another business", async () => {
    const { server, elbblick, weber } = await zwei();
    const antwort = await elbblick.inhaber.anfrage("/api/v1/terminal/karten", {
      body: { nutzerId: weber.mitarbeiterin.nutzerId, art: "uid", uid: UID_KARTE },
    });
    expect(antwort.status).toBe(404);
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM karten").get()).toEqual({ n: 0 });
  });

  it("POST /api/v1/terminal/karten takes a UID another business uses as well", async () => {
    const { server, elbblick, weber } = await zwei();
    await uidKarte(weber.inhaber, weber.mitarbeiterin.nutzerId);
    await uidKarte(elbblick.inhaber, elbblick.mitarbeiterin.nutzerId);
    expect(
      server.sqlite.query("SELECT DISTINCT betrieb_id FROM karten ORDER BY betrieb_id").all(),
    ).toHaveLength(2);
  });

  it("DELETE /api/v1/terminal/karten/:id does not reach another business's card", async () => {
    const { server, elbblick, weber } = await zwei();
    const { karteId } = await uidKarte(weber.inhaber, weber.mitarbeiterin.nutzerId);
    const antwort = await elbblick.inhaber.anfrage(`/api/v1/terminal/karten/${karteId}`, {
      method: "DELETE",
    });
    expect(antwort.status).toBe(404);
    expect(server.sqlite.query("SELECT widerrufen_am FROM karten").get()).toEqual({
      widerrufen_am: null,
    });
  });

  it("POST /api/v1/kiosk/erkennen does not take another business's card with PIN", async () => {
    const { weber, geraetElbblick } = await zwei();
    await uidKarte(weber.inhaber, weber.mitarbeiterin.nutzerId);
    const antwort = await geraetElbblick.anfrage("/api/v1/kiosk/erkennen", {
      body: { karte: UID_KARTE, pin: "471100" },
    });
    expect(antwort.status).toBe(401);
  });

  it("POST /api/v1/kiosk/erkennen does not take another business's NTAG 424 DNA", async () => {
    const { weber, geraetElbblick } = await zwei();
    await ntagKarte(weber.inhaber, weber.mitarbeiterin.nutzerId);
    const antwort = await geraetElbblick.anfrage("/api/v1/kiosk/erkennen", {
      body: { sun: sun(3) },
    });
    expect(antwort.status).toBe(401);
  });
});
