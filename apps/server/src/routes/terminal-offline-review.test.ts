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

  it("refuses an older SUN entry once the card was read online, and shows it to the owner", async () => {
    const e = await elbblick();
    await ntagKarte(e.inhaber, e.lea.nutzerId);
    // offline: Lea taps her card (counter 5) and comes; the entry waits on the tablet
    const wartend = await e.offline.eintrag({
      nummer: 1,
      ausweis: { sun: sun(5) },
      geraetZeitpunkt: JETZT - 10 * 60_000,
    });
    // the card is read online meanwhile (counter 6), at another terminal or before the tablet sent
    const online = await e.geraet.anfrage("/api/v1/kiosk/erkennen", { body: { sun: sun(6) } });
    expect(online.status).toBe(200);
    // the server cannot tell a real older read from one read off the card and played back: the
    // entry is refused and the owner sees it with its reason to add it by hand (round 2 of review)
    const antwort = await e.offline.senden({ ...wartend, gesendetAm: JETZT });
    expect(await json(antwort)).toEqual({ fehler: "ausweis_unbekannt" });
    expect((await e.stand())?.abgelehnt).toMatchObject([{ nummer: 1, grund: "ausweis_unbekannt" }]);
  });

  it("refuses a SUN message read off the card and played later with a back-dated tablet clock", async () => {
    const e = await elbblick();
    await ntagKarte(e.inhaber, e.lea.nutzerId);
    expect(
      (await e.geraet.anfrage("/api/v1/kiosk/erkennen", { body: { sun: sun(6) } })).status,
    ).toBe(200);
    e.server.stelleUhr(JETZT + 5 * 60_000);
    const gespielt = await e.offline.stempeln({
      nummer: 1,
      ausweis: { sun: sun(5) },
      geraetZeitpunkt: JETZT - 10 * 60_000,
      gesendetAm: JETZT + 5 * 60_000,
    });
    expect(await json(gespielt)).toEqual({ fehler: "ausweis_unbekannt" });
  });

  it("refuses an older SUN counter it cannot place before a later read", async () => {
    const e = await elbblick();
    await ntagKarte(e.inhaber, e.lea.nutzerId);
    await e.geraet.anfrage("/api/v1/kiosk/erkennen", { body: { sun: sun(6) } });
    // five minutes later, counter 5 comes as read just now: a message read off the card and kept
    e.server.stelleUhr(JETZT + 5 * 60_000);
    const spaeter = await e.offline.stempeln({
      nummer: 1,
      ausweis: { sun: sun(5) },
      geraetZeitpunkt: JETZT + 5 * 60_000,
      gesendetAm: JETZT + 5 * 60_000,
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

  it("makes no second stamp when the kiosk queued a /stempeln that timed out after FRIST_MS", async () => {
    const e = await elbblick();
    // the tap at 07:58 reaches the server, the answer does not come within the 15 s deadline
    const online = await e.geraet.anfrage("/api/v1/kiosk/stempeln", {
      body: { ausweis: { pin: "471100" }, art: "kommen", geraetZeitpunkt: JETZT },
    });
    expect(online.status).toBe(201);
    // the kiosk queues it with the time of the tap (dienst.ts) and sends it 20 s later
    e.server.stelleUhr(JETZT + 20_000);
    const antwort = await e.offline.stempeln({
      nummer: 1,
      ausweis: { pin: "471100" },
      geraetZeitpunkt: JETZT,
      gesendetAm: JETZT + 20_000,
    });
    expect(await e.tagVonLea()).toHaveLength(1);
    expect(antwort.status).toBe(200);
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
