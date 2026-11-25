import { describe, expect, it } from "vitest";
import { ntagKarte, sun } from "./karten-testhilfen.ts";
import { neuesPaar, offlineTablet } from "./terminal-offline-testhilfen.ts";
import { betriebMitTerminal, gekoppelt, JETZT, json, neuerServer } from "./terminal-testhilfen.ts";

/** Café Elbblick with Lea (PIN 471100) and a paired tablet with its key registered */
const elbblick = async () => {
  const server = neuerServer();
  const { inhaber, mitarbeiterin: lea } = await betriebMitTerminal(server);
  const geraet = await gekoppelt(server, inhaber);
  const offline = await offlineTablet(geraet);
  expect((await offline.anmelden()).status).toBe(201);
  const stand = async () =>
    (
      (await json(await inhaber.anfrage("/api/v1/terminal/geraete"))).terminals as {
        offline: { luecken: unknown[]; abgelehnt: { nummer: number; grund: string }[] };
      }[]
    )[0]?.offline;
  const tagVonLea = async () =>
    (
      (await json(
        await inhaber.anfrage(`/api/v1/arbeitszeit/tag?nutzerId=${lea.nutzerId}&datum=2026-11-20`),
      )) as { stempelungen: Record<string, unknown>[] }
    ).stempelungen;
  return { server, inhaber, lea, geraet, offline, stand, tagVonLea };
};

describe("the tablet's key for its offline queue (S-803)", { timeout: 20_000 }, () => {
  it("is registered once: again the same is fine, another key is refused", async () => {
    const e = await elbblick();
    expect((await e.offline.anmelden()).status).toBe(200);
    expect((await e.offline.anmelden(await neuesPaar())).status).toBe(409);
  });

  it("refuses what is no key of P-256", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const antwort = await geraet.anfrage("/api/v1/kiosk/schluessel", {
      method: "PUT",
      body: { schluessel: { kty: "EC", crv: "P-256", x: "A".repeat(43), y: "A".repeat(43) } },
    });
    expect(antwort.status).toBe(400);
  });

  it("hands the tablet the server's key for credentials, the same for every terminal", async () => {
    const e = await elbblick();
    const zweites = await offlineTablet(await gekoppelt(e.server, e.inhaber, "Küche"));
    expect(e.offline.server).toMatchObject({ kty: "EC", crv: "P-256" });
    expect(zweites.server).toEqual(e.offline.server);
  });

  it("lets an entry wait while the terminal has no key yet", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const offline = await offlineTablet(await gekoppelt(server, inhaber));
    const antwort = await offline.stempeln({ nummer: 1, ausweis: { pin: "471100" } });
    expect(antwort.status).toBe(409);
    expect(await json(antwort)).toEqual({ fehler: "schluessel_fehlt" });
  });
});

describe("an entry of the terminal's offline queue (S-803)", { timeout: 20_000 }, () => {
  it("stamps for the person its PIN names, from the terminal, offline, at the device's time", async () => {
    const e = await elbblick();
    // stamped at 07:50 on the tablet, sent at 07:57 by its clock, received at 07:58
    const antwort = await e.offline.stempeln({
      nummer: 1,
      ausweis: { pin: "471100" },
      geraetZeitpunkt: JETZT - 8 * 60_000,
      gesendetAm: JETZT - 60_000,
    });
    expect(antwort.status).toBe(201);
    expect(await e.tagVonLea()).toMatchObject([
      {
        art: "kommen",
        quelle: "terminal",
        offline: true,
        zeitpunkt: JETZT - 7 * 60_000,
        geraetZeitpunkt: JETZT - 8 * 60_000,
      },
    ]);
    const zeile = e.server.sqlite
      .query("SELECT terminal_id, erstellt_von, erstellt_am FROM stempelungen")
      .get() as Record<string, unknown>;
    expect(zeile).toEqual({
      terminal_id: e.geraet.terminalId,
      erstellt_von: e.lea.nutzerId,
      erstellt_am: JETZT,
    });
  });

  it("makes one stamp of the same entry sent twice", async () => {
    const e = await elbblick();
    const eintrag = await e.offline.eintrag({ nummer: 1, ausweis: { pin: "471100" } });
    const erste = await e.offline.senden(eintrag);
    const zweite = await e.offline.senden(eintrag);
    expect(erste.status).toBe(201);
    expect(zweite.status).toBe(200);
    expect(await json(zweite)).toEqual(await json(erste));
    expect(await e.tagVonLea()).toHaveLength(1);
  });

  it("refuses another entry under a number already taken", async () => {
    const e = await elbblick();
    await e.offline.stempeln({ nummer: 1, ausweis: { pin: "471100" } });
    const antwort = await e.offline.stempeln({
      nummer: 1,
      ausweis: { pin: "471100" },
      art: "gehen",
    });
    expect(antwort.status).toBe(409);
    expect(await json(antwort)).toEqual({ fehler: "doppelt" });
    expect(await e.tagVonLea()).toHaveLength(1);
  });

  it("refuses an entry signed by another key or changed after signing, and keeps nothing of it", async () => {
    const e = await elbblick();
    const fremd = await e.offline.eintrag(
      { nummer: 1, ausweis: { pin: "471100" } },
      await neuesPaar(),
    );
    expect((await e.offline.senden(fremd)).status).toBe(422);
    const echt = await e.offline.eintrag({ nummer: 1, ausweis: { pin: "471100" } });
    expect((await e.offline.senden({ ...echt, art: "gehen" })).status).toBe(422);
    expect((await e.offline.senden({ ...echt, nummer: 2 })).status).toBe(422);
    expect(await e.tagVonLea()).toEqual([]);
    expect(await e.stand()).toEqual({ luecken: [], abgelehnt: [] });
  });

  it("refuses a wrong PIN, counts it toward the lock and shows it to the owner", async () => {
    const e = await elbblick();
    for (let nummer = 1; nummer <= 4; nummer++) {
      const antwort = await e.offline.stempeln({
        nummer,
        ausweis: { pin: String(600000 + nummer) },
      });
      expect(antwort.status).toBe(422);
      expect(await json(antwort)).toEqual({ fehler: "ausweis_unbekannt" });
    }
    expect((await json(await e.geraet.anfrage("/api/v1/kiosk"))).gesperrtBis).toBeNull();
    // the fifth wrong one locks the terminal and is itself refused for good
    expect((await e.offline.stempeln({ nummer: 5, ausweis: { pin: "600005" } })).status).toBe(422);
    expect((await json(await e.geraet.anfrage("/api/v1/kiosk"))).gesperrtBis).toBe(JETZT + 60_000);
    // the short wait paces typing at the tablet; queued entries go on (review of S-803)
    const lea = await e.offline.stempeln({ nummer: 6, ausweis: { pin: "471100" } });
    expect(lea.status).toBe(201);
    const stand = await e.stand();
    expect(stand?.abgelehnt.map((a) => [a.nummer, a.grund])).toEqual(
      [1, 2, 3, 4, 5].map((nummer) => [nummer, "ausweis_unbekannt"]),
    );
    // every try stands in the audit chain, written by the terminal
    const glieder = e.server.sqlite
      .query("SELECT COUNT(*) AS n FROM audit_glieder WHERE akteur = ? AND tabelle = 'terminals'")
      .get(`terminal:${e.geraet.terminalId}`) as { n: number };
    expect(glieder.n).toBeGreaterThanOrEqual(5);
  });

  it("shows the owner a gap in the numbers until the missing entry arrives", async () => {
    const e = await elbblick();
    await e.offline.stempeln({ nummer: 1, ausweis: { pin: "471100" } });
    await e.offline.stempeln({ nummer: 4, ausweis: { pin: "471100" }, art: "gehen" });
    expect((await e.stand())?.luecken).toEqual([{ von: 2, bis: 3 }]);
    await e.offline.stempeln({ nummer: 2, ausweis: { pin: "471100" }, art: "pause_beginn" });
    await e.offline.stempeln({ nummer: 3, ausweis: { pin: "471100" }, art: "pause_ende" });
    expect((await e.stand())?.luecken).toEqual([]);
  });

  it("refuses a credential encrypted for another terminal", async () => {
    const e = await elbblick();
    const antwort = await e.offline.stempeln({
      nummer: 1,
      ausweis: { pin: "471100" },
      fuer: "ein-anderes-terminal",
    });
    expect(antwort.status).toBe(422);
    expect(await json(antwort)).toEqual({ fehler: "ausweis_unlesbar" });
  });

  it("refuses a receipt: it holds 20 seconds, no entry waits that short", async () => {
    const e = await elbblick();
    const antwort = await e.offline.stempeln({ nummer: 1, ausweis: { beleg: "x" } });
    expect(await json(antwort)).toEqual({ fehler: "ausweis_unlesbar" });
  });

  it("refuses an entry stamped after it was sent", async () => {
    const e = await elbblick();
    const antwort = await e.offline.stempeln({
      nummer: 1,
      ausweis: { pin: "471100" },
      geraetZeitpunkt: JETZT,
      gesendetAm: JETZT - 1,
    });
    expect(await json(antwort)).toEqual({ fehler: "zukunft" });
    expect((await e.stand())?.abgelehnt).toMatchObject([{ nummer: 1, grund: "zukunft" }]);
  });

  it("recognises an NTAG 424 DNA by its SUN message once, and refuses the message again", async () => {
    const e = await elbblick();
    await ntagKarte(e.inhaber, e.lea.nutzerId);
    expect((await e.offline.stempeln({ nummer: 1, ausweis: { sun: sun(5) } })).status).toBe(201);
    const wieder = await e.offline.stempeln({ nummer: 2, ausweis: { sun: sun(5) }, art: "gehen" });
    expect(await json(wieder)).toEqual({ fehler: "ausweis_unbekannt" });
    expect(await e.tagVonLea()).toHaveLength(1);
  });

  it("takes nothing from a revoked terminal", async () => {
    const e = await elbblick();
    await e.inhaber.anfrage(`/api/v1/terminal/geraete/${e.geraet.terminalId}`, {
      method: "DELETE",
    });
    const antwort = await e.offline.stempeln({ nummer: 1, ausweis: { pin: "471100" } });
    expect(antwort.status).toBe(401);
    expect(await e.tagVonLea()).toEqual([]);
  });

  it("is refused while the module Terminal is off", async () => {
    const e = await elbblick();
    await e.inhaber.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { terminal: false },
    });
    expect((await e.offline.stempeln({ nummer: 1, ausweis: { pin: "471100" } })).status).toBe(403);
    expect((await e.offline.anmelden()).status).toBe(403);
  });
});
