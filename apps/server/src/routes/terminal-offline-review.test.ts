import { base64url, terminalNachricht } from "@soll/arbeitszeit";
import { describe, expect, it } from "vitest";
import { ntagKarte, sun } from "./karten-testhilfen.ts";
import { neuesPaar, offlineTablet } from "./terminal-offline-testhilfen.ts";
import { betriebMitTerminal, gekoppelt, JETZT, json, neuerServer } from "./terminal-testhilfen.ts";

/** Café Elbblick with Lea (PIN 471100) and a paired tablet whose key pair the test holds */
const elbblick = async () => {
  const server = neuerServer();
  const { inhaber, mitarbeiterin: lea } = await betriebMitTerminal(server);
  const geraet = await gekoppelt(server, inhaber);
  const paar = await neuesPaar();
  const offline = await offlineTablet(geraet, paar);
  expect((await offline.anmelden()).status).toBe(201);
  const tagVonLea = async () =>
    (
      (await json(
        await inhaber.anfrage(`/api/v1/arbeitszeit/tag?nutzerId=${lea.nutzerId}&datum=2026-11-20`),
      )) as { stempelungen: Record<string, unknown>[] }
    ).stempelungen;
  const stand = async () =>
    (
      (await json(await inhaber.anfrage("/api/v1/terminal/geraete"))).terminals as {
        offline: { abgelehnt: { nummer: number; grund: string }[] };
      }[]
    )[0]?.offline;
  return { server, inhaber, lea, geraet, paar, offline, tagVonLea, stand };
};

describe("review of S-803: the offline queue of the terminal", { timeout: 60_000 }, () => {
  it("does not let an encrypted credential be reused in another entry", async () => {
    const e = await elbblick();
    // Lea's PIN, typed once while offline, as it lies encrypted in the tablet's IndexedDB
    const echt = await e.offline.eintrag({ nummer: 1, ausweis: { pin: "471100" } });
    expect((await e.offline.senden(echt)).status).toBe(201);
    // whoever holds the tablet (its key signs, it cannot be exported but it can be used) takes the
    // cipher text and signs a new entry: another number, another kind, an earlier time
    const ohne = {
      terminalId: e.geraet.terminalId,
      nummer: 2,
      art: "gehen" as const,
      geraetZeitpunkt: JETZT - 30_000,
      ausweis: echt.ausweis,
    };
    const signatur = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      e.paar.privateKey,
      new TextEncoder().encode(terminalNachricht(ohne)),
    );
    const { terminalId: _, ...body } = ohne;
    const antwort = await e.offline.senden({
      ...body,
      gesendetAm: JETZT - 30_000,
      signatur: base64url(new Uint8Array(signatur)),
    });
    expect(antwort.status).not.toBe(201);
    expect(await e.tagVonLea()).toHaveLength(1);
  });

  it("does not lose an older SUN entry because the card was read online in between", async () => {
    const e = await elbblick();
    await ntagKarte(e.inhaber, e.lea.nutzerId);
    // offline: Lea taps her card (counter 5) and comes; the entry waits on the tablet
    const wartend = await e.offline.eintrag({
      nummer: 1,
      ausweis: { sun: sun(5) },
      geraetZeitpunkt: JETZT - 10 * 60_000,
    });
    // the server is back before the queue's next try (up to 30 s); Lea taps again (counter 6)
    const online = await e.geraet.anfrage("/api/v1/kiosk/erkennen", { body: { sun: sun(6) } });
    expect(online.status).toBe(200);
    // the queue sends the older entry: a real stamp of Lea, read before the online one
    const antwort = await e.offline.senden({ ...wartend, gesendetAm: JETZT });
    expect(antwort.status).toBe(201);
    const fehlversuche = e.server.sqlite
      .query("SELECT fehlversuche FROM terminals WHERE terminal_id = ?")
      .get(e.geraet.terminalId) as { fehlversuche: number };
    expect(fehlversuche.fehlversuche).toBe(0);
    // the same message once more is a replay, also from the queue
    const wieder = await e.offline.stempeln({
      nummer: 2,
      ausweis: { sun: sun(5) },
      geraetZeitpunkt: JETZT - 10 * 60_000,
      gesendetAm: JETZT,
    });
    expect(await json(wieder)).toEqual({ fehler: "ausweis_unbekannt" });
  });

  it("refuses an older SUN counter it cannot place before a later read", async () => {
    const e = await elbblick();
    await ntagKarte(e.inhaber, e.lea.nutzerId);
    await e.geraet.anfrage("/api/v1/kiosk/erkennen", { body: { sun: sun(6) } });
    // counter 5 claims to be read after counter 6 was: a message read off the card and kept
    const spaeter = await e.offline.stempeln({
      nummer: 1,
      ausweis: { sun: sun(5) },
      geraetZeitpunkt: JETZT + 60_000,
      gesendetAm: JETZT + 60_000,
    });
    expect(await json(spaeter)).toEqual({ fehler: "ausweis_unbekannt" });
  });

  it("goes past the short waits: Lea's PIN after five offline guesses stamps", async () => {
    const e = await elbblick();
    for (let nummer = 1; nummer <= 5; nummer++)
      await e.offline.stempeln({ nummer, ausweis: { pin: String(600000 + nummer) } });
    const lea = await e.offline.stempeln({ nummer: 6, ausweis: { pin: "471100" } });
    expect(lea.status).toBe(201);
  });

  it("does not hold honest stamps behind a queue of offline guesses", async () => {
    const e = await elbblick();
    const { wert } = (await json(
      await e.inhaber.anfrage(`/api/v1/terminal/ausweise/${e.lea.nutzerId}`, { body: {} }),
    )) as { wert: string };
    // one person at the tablet without network types 60 wrong PINs, then Lea comes twice
    const status: number[] = [];
    for (let nummer = 1; nummer <= 60; nummer++)
      status.push(
        (await e.offline.stempeln({ nummer, ausweis: { pin: String(600000 + nummer) } })).status,
      );
    const mitPin = await e.offline.stempeln({ nummer: 61, ausweis: { pin: "471100" } });
    const mitQr = await e.offline.stempeln({ nummer: 62, ausweis: { qr: wert }, art: "gehen" });
    // nothing waits on the tablet: each entry is answered at once
    expect(status.filter((s) => s !== 422)).toEqual([]);
    // the QR code cannot be guessed: it is compared even while the terminal is locked till midnight
    expect(mitQr.status).toBe(201);
    // a PIN can: after the day's twenty wrong ones it is refused, kept for the owner with a reason
    expect(await json(mitPin)).toEqual({ fehler: "gesperrt" });
    const abgelehnt = (await e.stand())?.abgelehnt ?? [];
    expect(abgelehnt.filter((a) => a.grund === "ausweis_unbekannt")).toHaveLength(20);
    expect(abgelehnt.find((a) => a.nummer === 61)?.grund).toBe("gesperrt");
    expect(await e.tagVonLea()).toMatchObject([{ art: "gehen" }]);
  });

  it("makes no second stamp when an online stamp's answer was lost and the tablet queued it", async () => {
    const e = await elbblick();
    // the server stamps at 07:58, the answer never reaches the tablet
    const online = await e.geraet.anfrage("/api/v1/kiosk/stempeln", {
      body: { ausweis: { pin: "471100" }, art: "kommen", geraetZeitpunkt: JETZT - 1_000 },
    });
    expect(online.status).toBe(201);
    // the tablet keeps the same tap in its queue and sends it a moment later
    const antwort = await e.offline.stempeln({
      nummer: 1,
      ausweis: { pin: "471100" },
      geraetZeitpunkt: JETZT - 1_000,
      gesendetAm: JETZT + 4_000,
    });
    expect(antwort.status).toBe(200);
    expect(await e.tagVonLea()).toHaveLength(1);
  });
});
