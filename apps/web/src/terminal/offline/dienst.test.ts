import { terminalNachricht } from "@soll/arbeitszeit";
import { describe, expect, it } from "vitest";
import type { Antwort } from "../../api.ts";
import { kioskAblageImSpeicher, type Schluessel } from "./ablage.ts";
import { type KioskAbhaengigkeiten, kioskSchlange } from "./dienst.ts";
import { folge, offlineAusweis } from "./schlange.ts";

const um = (zeit: string) => Date.parse(`2026-11-20T${zeit}+01:00`);
const TERMINAL = "0b7c2f1e-1d4f-4c7e-9a43-2c1f0e9b7d10";
const TOKEN = "geraete-token";

type Aufruf = { pfad: string; method: string; body: Record<string, unknown>; token: string };

const bytesAus = (base64url: string) =>
  Uint8Array.from(atob(base64url.replaceAll("-", "+").replaceAll("_", "/")), (z) =>
    z.charCodeAt(0),
  );

/** The server's key pair for credentials, as GET /api/v1/kiosk hands out its public half */
const serverSchluessel = async (): Promise<Schluessel> => {
  const paar = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", paar.publicKey);
  return { kty: "EC", crv: "P-256", x: jwk.x ?? "", y: jwk.y ?? "" };
};

/**
 * The queue with a map for IndexedDB, the runtime's WebCrypto and a stand-in for the kiosk's API:
 * it keeps the key the tablet registers, checks each entry's signature against it like the server
 * and answers with `antworten` (201 unless a test says else)
 */
const aufbau = (antworten: (aufruf: Aufruf) => number | [number, string] = () => 201) => {
  const ablage = kioskAblageImSpeicher();
  const aufrufe: Aufruf[] = [];
  const signaturen: boolean[] = [];
  let angemeldet: CryptoKey | null = null;
  let uhr = um("07:58");
  let kette: Promise<unknown> = Promise.resolve();
  const abh: KioskAbhaengigkeiten = {
    ablage,
    subtle: crypto.subtle,
    jetzt: () => uhr,
    sperre: (arbeit) => {
      const lauf = kette.then(arbeit, arbeit);
      kette = lauf.catch(() => undefined);
      return lauf;
    },
    api: async (pfad, init) => {
      const body = init.body as Record<string, unknown>;
      const aufruf = {
        pfad,
        method: init.method ?? "POST",
        body,
        token: init.headers?.authorization ?? "",
      };
      aufrufe.push(aufruf);
      const code = antworten(aufruf);
      const [status, fehler] = typeof code === "number" ? [code, "netz"] : code;
      if (status >= 200 && status < 300 && pfad === "/api/v1/kiosk/schluessel")
        angemeldet = await crypto.subtle.importKey(
          "jwk",
          body.schluessel as JsonWebKey,
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["verify"],
        );
      if (pfad === "/api/v1/kiosk/offline" && angemeldet)
        signaturen.push(
          await crypto.subtle.verify(
            { name: "ECDSA", hash: "SHA-256" },
            angemeldet,
            bytesAus(body.signatur as string),
            new TextEncoder().encode(
              terminalNachricht({
                terminalId: TERMINAL,
                nummer: body.nummer as number,
                art: body.art as "kommen",
                geraetZeitpunkt: body.geraetZeitpunkt as number,
                ausweis: body.ausweis as string,
              }),
            ),
          ),
        );
      return (
        status >= 200 && status < 300
          ? { ok: true, status, daten: {} }
          : { ok: false, status, fehler }
      ) as Antwort<unknown>;
    },
  };
  return {
    schlange: kioskSchlange(abh),
    ablage,
    aufrufe,
    signaturen,
    stelleUhr: (ms: number) => {
      uhr = ms;
    },
  };
};

const PIN = { pin: "471100" };

describe("the tablet's offline queue (S-803)", () => {
  it("makes a key on the first start, registers it once and keeps the server's key", async () => {
    const a = aufbau();
    const server = await serverSchluessel();
    const geraet = await a.schlange.vorbereiten(TOKEN, TERMINAL, server);
    expect(geraet).toMatchObject({
      terminalId: TERMINAL,
      angemeldet: "ja",
      server,
      letzteNummer: 0,
    });
    expect(geraet.privat.extractable).toBe(false);
    await a.schlange.vorbereiten(TOKEN, TERMINAL, server);
    expect(a.aufrufe.map((x) => [x.method, x.pfad, x.token])).toEqual([
      ["PUT", "/api/v1/kiosk/schluessel", `Bearer ${TOKEN}`],
    ]);
  });

  it("takes nothing before it knows the server's key", async () => {
    const a = aufbau();
    expect(await a.schlange.bereit(TERMINAL)).toBe(false);
    expect(await a.schlange.aufnehmen(TERMINAL, PIN, "kommen")).toBeNull();
  });

  it("numbers the entries, keeps the PIN only encrypted and signs every entry", async () => {
    const a = aufbau(() => 0);
    const server = await serverSchluessel();
    await a.schlange.vorbereiten(TOKEN, TERMINAL, server);
    expect(await a.schlange.bereit(TERMINAL)).toBe(true);
    const erster = await a.schlange.aufnehmen(TERMINAL, PIN, "kommen");
    a.stelleUhr(um("12:00"));
    const zweiter = await a.schlange.aufnehmen(
      TERMINAL,
      { qr: "soll-ausweis:abc" },
      "pause_beginn",
    );
    expect([erster?.nummer, zweiter?.nummer]).toEqual([1, 2]);
    expect(erster).toMatchObject({ art: "kommen", geraetZeitpunkt: um("07:58") });
    const gespeichert = JSON.stringify(await a.ablage.eintraege(TERMINAL));
    expect(gespeichert).not.toContain("471100");
    expect(gespeichert).not.toContain("soll-ausweis");
    expect(await a.schlange.stand(TERMINAL)).toEqual({ wartend: 2, zuletzt: null });
  });

  it("sends in the order of the numbers once the network is back, and every signature holds", async () => {
    let netz = false;
    const a = aufbau((x) => (x.pfad === "/api/v1/kiosk/offline" && !netz ? 0 : 201));
    await a.schlange.vorbereiten(TOKEN, TERMINAL, await serverSchluessel());
    await a.schlange.aufnehmen(TERMINAL, PIN, "kommen");
    await a.schlange.aufnehmen(TERMINAL, PIN, "gehen");
    expect(await a.schlange.uebertragen(TOKEN, TERMINAL)).toEqual({
      erledigt: 0,
      wartend: 2,
      entkoppelt: false,
    });
    netz = true;
    a.stelleUhr(um("16:30"));
    expect(await a.schlange.uebertragen(TOKEN, TERMINAL)).toEqual({
      erledigt: 2,
      wartend: 0,
      entkoppelt: false,
    });
    const gesendet = a.aufrufe.filter((x) => x.pfad === "/api/v1/kiosk/offline").slice(-2);
    expect(gesendet.map((x) => [x.body.nummer, x.body.art, x.body.gesendetAm])).toEqual([
      [1, "kommen", um("16:30")],
      [2, "gehen", um("16:30")],
    ]);
    expect(a.signaturen.slice(-2)).toEqual([true, true]);
    expect(await a.schlange.stand(TERMINAL)).toEqual({ wartend: 0, zuletzt: um("16:30") });
  });

  it("stops at an entry that must wait, so the numbers arrive in order", async () => {
    const a = aufbau((x) => (x.body?.nummer === 2 ? [423, "gesperrt"] : 201));
    await a.schlange.vorbereiten(TOKEN, TERMINAL, await serverSchluessel());
    for (const art of ["kommen", "pause_beginn", "gehen"] as const)
      await a.schlange.aufnehmen(TERMINAL, PIN, art);
    expect(await a.schlange.uebertragen(TOKEN, TERMINAL)).toEqual({
      erledigt: 1,
      wartend: 2,
      entkoppelt: false,
    });
    expect((await a.ablage.eintraege(TERMINAL)).map((e) => e.nummer)).toEqual([2, 3]);
  });

  it("lets an entry the server refused for good leave the tablet: the owner sees it there", async () => {
    const a = aufbau((x) => (x.body?.nummer === 1 ? [422, "ausweis_unbekannt"] : 201));
    await a.schlange.vorbereiten(TOKEN, TERMINAL, await serverSchluessel());
    await a.schlange.aufnehmen(TERMINAL, { pin: "000000" }, "kommen");
    await a.schlange.aufnehmen(TERMINAL, PIN, "kommen");
    expect(await a.schlange.uebertragen(TOKEN, TERMINAL)).toMatchObject({
      erledigt: 2,
      wartend: 0,
    });
  });

  it("sends nothing more from a revoked terminal", async () => {
    const a = aufbau((x) =>
      x.pfad === "/api/v1/kiosk/offline" ? [401, "terminal_unbekannt"] : 201,
    );
    await a.schlange.vorbereiten(TOKEN, TERMINAL, await serverSchluessel());
    await a.schlange.aufnehmen(TERMINAL, PIN, "kommen");
    expect(await a.schlange.uebertragen(TOKEN, TERMINAL)).toEqual({
      erledigt: 0,
      wartend: 1,
      entkoppelt: true,
    });
  });

  it("registers a key it could not register before sending, and keeps entries until then", async () => {
    let netz = false;
    const a = aufbau(() => (netz ? 201 : 0));
    await a.schlange.vorbereiten(TOKEN, TERMINAL, await serverSchluessel());
    await a.schlange.aufnehmen(TERMINAL, PIN, "kommen");
    expect(await a.schlange.uebertragen(TOKEN, TERMINAL)).toMatchObject({
      erledigt: 0,
      wartend: 1,
    });
    netz = true;
    expect(await a.schlange.uebertragen(TOKEN, TERMINAL)).toMatchObject({
      erledigt: 1,
      wartend: 0,
    });
    expect(
      a.aufrufe.filter((x) => x.pfad === "/api/v1/kiosk/schluessel" && x.method === "PUT"),
    ).toHaveLength(3);
  });

  it("takes no entry when the server has another key for the terminal", async () => {
    const a = aufbau((x) => (x.pfad === "/api/v1/kiosk/schluessel" ? [409, "vergeben"] : 201));
    await a.schlange.vorbereiten(TOKEN, TERMINAL, await serverSchluessel());
    expect(await a.schlange.bereit(TERMINAL)).toBe(false);
    expect(await a.schlange.aufnehmen(TERMINAL, PIN, "kommen")).toBeNull();
  });
});

describe("the queue as data (S-803)", () => {
  it("keeps every credential but the 20-second receipt", () => {
    expect(offlineAusweis(PIN)).toEqual(PIN);
    expect(offlineAusweis({ sun: { e: "a", c: "b" } })).toEqual({ sun: { e: "a", c: "b" } });
    expect(offlineAusweis({ beleg: "x" })).toBeNull();
  });

  it("tries again later without network, while locked or before the key, else gives up", () => {
    expect([200, 201].map((s) => folge(s))).toEqual(["uebertragen", "uebertragen"]);
    expect([0, 403, 408, 423, 429, 500, 503].map((s) => folge(s))).toEqual(
      Array(7).fill("spaeter"),
    );
    expect(folge(409, "schluessel_fehlt")).toBe("spaeter");
    expect(folge(409, "doppelt")).toBe("abgelehnt");
    expect([400, 422].map((s) => folge(s))).toEqual(["abgelehnt", "abgelehnt"]);
    expect(folge(401, "terminal_unbekannt")).toBe("entkoppelt");
  });
});
