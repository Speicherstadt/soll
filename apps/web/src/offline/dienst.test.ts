import { stempelNachricht } from "@soll/arbeitszeit";
import { describe, expect, it } from "vitest";
import type { Antwort } from "../api.ts";
import { ablageImSpeicher } from "./ablage.ts";
import { type Abhaengigkeiten, warteschlange } from "./dienst.ts";

const um = (zeit: string) => Date.parse(`2026-11-20T${zeit}+01:00`);
const TOM = "elbblick/tom";

type Aufruf = { pfad: string; method: string; body: Record<string, unknown> };

/**
 * The queue with a map for IndexedDB, the runtime's WebCrypto and a stand-in for the API that answers
 * with the statuses given (200 for everything else); a lock that runs one task after the other
 */
const aufbau = (antworten: (aufruf: Aufruf) => number = () => 200) => {
  const ablage = ablageImSpeicher();
  const aufrufe: Aufruf[] = [];
  let uhr = um("07:58");
  let ids = 0;
  let kette: Promise<unknown> = Promise.resolve();
  // while set, every call of the API waits for it (a slow network)
  let halt: Promise<void> | null = null;
  const abh: Abhaengigkeiten = {
    ablage,
    subtle: crypto.subtle,
    jetzt: () => uhr,
    neueId: () => `00000000-0000-4000-8000-00000000000${++ids}`,
    sperre: (arbeit) => {
      const lauf = kette.then(arbeit, arbeit);
      kette = lauf.catch(() => undefined);
      return lauf;
    },
    api: async (pfad, init) => {
      const aufruf = {
        pfad,
        method: init.method ?? "POST",
        body: init.body as Record<string, unknown>,
      };
      aufrufe.push(aufruf);
      if (halt) await halt;
      const status = antworten(aufruf);
      return (
        status >= 200 && status < 300
          ? { ok: true, status, daten: {} }
          : { ok: false, status, fehler: status === 0 ? "netz" : "doppelt" }
      ) as Antwort<unknown>;
    },
  };
  return {
    schlange: warteschlange(abh),
    ablage,
    aufrufe,
    stelleUhr: (ms: number) => {
      uhr = ms;
    },
    /** holds every call of the API until the function returned is called */
    anhalten: () => {
      let weiter = () => {};
      halt = new Promise((fertig) => {
        weiter = () => {
          halt = null;
          fertig();
        };
      });
      return weiter;
    },
  };
};

const base64urlBytes = (text: string) =>
  Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

describe("taking a stamp into the queue (S-305)", () => {
  it("numbers the entries of a device from 1 and keeps the device's time", async () => {
    const { schlange, stelleUhr } = aufbau();
    const eins = await schlange.aufnehmen(TOM, "kommen");
    stelleUhr(um("12:00"));
    const zwei = await schlange.aufnehmen(TOM, "pause_beginn");
    expect([eins.nummer, zwei.nummer]).toEqual([1, 2]);
    expect(zwei).toMatchObject({
      geraetId: eins.geraetId,
      art: "pause_beginn",
      geraetZeitpunkt: um("12:00"),
    });
  });

  it("gives two stamps at the same moment two numbers", async () => {
    const { schlange } = aufbau();
    const beide = await Promise.all([
      schlange.aufnehmen(TOM, "kommen"),
      schlange.aufnehmen(TOM, "gehen"),
    ]);
    expect(beide.map((e) => e.nummer).sort()).toEqual([1, 2]);
  });

  it("keeps a device and its numbers per person and business", async () => {
    const { schlange } = aufbau();
    const tom = await schlange.aufnehmen(TOM, "kommen");
    const lea = await schlange.aufnehmen("elbblick/lea", "kommen");
    expect(lea.nummer).toBe(1);
    expect(lea.geraetId).not.toBe(tom.geraetId);
  });

  it("signs each entry with a key the device cannot hand out", async () => {
    const { schlange, ablage } = aufbau();
    const eintrag = await schlange.aufnehmen(TOM, "kommen");
    const geraet = await ablage.geraet(TOM);
    if (!geraet) throw new Error("no device");
    expect(geraet.privat.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("jwk", geraet.privat)).rejects.toThrow();
    const oeffentlich = await crypto.subtle.importKey(
      "jwk",
      geraet.schluessel,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const gueltig = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      oeffentlich,
      base64urlBytes(eintrag.signatur),
      new TextEncoder().encode(stempelNachricht(eintrag)),
    );
    expect(gueltig).toBe(true);
    expect(Object.keys(geraet.schluessel).sort()).toEqual(["crv", "kty", "x", "y"]);
  });
});

describe("sending the queue (S-305)", () => {
  it("registers the device once and sends the stamp just taken live", async () => {
    const { schlange, aufrufe } = aufbau();
    const eintrag = await schlange.aufnehmen(TOM, "kommen");
    expect(await schlange.uebertragen(TOM, eintrag.nummer)).toEqual({ uebertragen: 1, wartend: 0 });
    expect(aufrufe.map((a) => `${a.method} ${a.pfad}`)).toEqual([
      `PUT /api/v1/arbeitszeit/geraete/${eintrag.geraetId}`,
      "POST /api/v1/arbeitszeit/stempelungen",
    ]);
    expect(aufrufe[1]?.body).toEqual({
      art: "kommen",
      geraetZeitpunkt: um("07:58"),
      geraet: { geraetId: eintrag.geraetId, nummer: 1, signatur: eintrag.signatur },
    });
    expect(await schlange.eintraege(TOM)).toEqual([]);
    const zweites = await schlange.aufnehmen(TOM, "gehen");
    await schlange.uebertragen(TOM, zweites.nummer);
    expect(aufrufe.filter((a) => a.method === "PUT")).toHaveLength(1);
  });

  it("keeps what it cannot send without a network and sends it later in order, as offline entries", async () => {
    let netz = false;
    const { schlange, aufrufe, stelleUhr } = aufbau(() => (netz ? 201 : 0));
    const eins = await schlange.aufnehmen(TOM, "kommen");
    expect(await schlange.uebertragen(TOM, eins.nummer)).toEqual({ uebertragen: 0, wartend: 1 });
    stelleUhr(um("12:00"));
    const zwei = await schlange.aufnehmen(TOM, "pause_beginn");
    expect(await schlange.uebertragen(TOM, zwei.nummer)).toEqual({ uebertragen: 0, wartend: 2 });
    expect((await schlange.eintraege(TOM)).map((e) => e.nummer).sort()).toEqual([1, 2]);

    netz = true;
    stelleUhr(um("12:30"));
    aufrufe.length = 0;
    expect(await schlange.uebertragen(TOM)).toEqual({ uebertragen: 2, wartend: 0 });
    expect(aufrufe.map((a) => a.pfad)).toEqual([
      `/api/v1/arbeitszeit/geraete/${eins.geraetId}`,
      "/api/v1/arbeitszeit/stempelungen/offline",
      "/api/v1/arbeitszeit/stempelungen/offline",
    ]);
    expect(
      aufrufe.slice(1).map((a) => [a.body.art, a.body.geraetZeitpunkt, a.body.gesendetAm]),
    ).toEqual([
      ["kommen", um("07:58"), um("12:30")],
      ["pause_beginn", um("12:00"), um("12:30")],
    ]);
    expect(await schlange.eintraege(TOM)).toEqual([]);
  });

  it("sends older entries first and the stamp just taken live after them", async () => {
    let netz = false;
    const { schlange, aufrufe } = aufbau(() => (netz ? 201 : 0));
    await schlange.aufnehmen(TOM, "kommen");
    await schlange.uebertragen(TOM, 1);
    netz = true;
    aufrufe.length = 0;
    const zwei = await schlange.aufnehmen(TOM, "gehen");
    await schlange.uebertragen(TOM, zwei.nummer);
    expect(aufrufe.map((a) => a.pfad)).toEqual([
      expect.stringContaining("/geraete/"),
      "/api/v1/arbeitszeit/stempelungen/offline",
      "/api/v1/arbeitszeit/stempelungen",
    ]);
  });

  it("stops at the first entry that cannot go now, so the numbers arrive in order", async () => {
    let erlaubt = 1;
    const { schlange, aufrufe } = aufbau((aufruf) =>
      aufruf.method === "PUT" ? 201 : erlaubt-- > 0 ? 201 : 503,
    );
    for (const art of ["kommen", "pause_beginn", "pause_ende"] as const)
      await schlange.aufnehmen(TOM, art);
    expect(await schlange.uebertragen(TOM)).toEqual({ uebertragen: 1, wartend: 2 });
    expect(aufrufe.filter((a) => a.method === "POST")).toHaveLength(2);
    expect((await schlange.eintraege(TOM)).map((e) => e.nummer).sort()).toEqual([2, 3]);
  });

  it("marks an entry the server refused, keeps it in sight and goes on with the next", async () => {
    const { schlange } = aufbau((aufruf) =>
      aufruf.method === "PUT" || (aufruf.body.geraet as { nummer: number }).nummer !== 1
        ? 201
        : 409,
    );
    await schlange.aufnehmen(TOM, "kommen");
    await schlange.aufnehmen(TOM, "gehen");
    expect(await schlange.uebertragen(TOM)).toEqual({ uebertragen: 1, wartend: 0 });
    expect(await schlange.eintraege(TOM)).toMatchObject([{ nummer: 1, abgelehnt: "doppelt" }]);
    // a refused entry is not sent again
    expect(await schlange.uebertragen(TOM)).toEqual({ uebertragen: 0, wartend: 0 });
  });

  it("sends nothing while the device is not registered", async () => {
    const { schlange, aufrufe } = aufbau((aufruf) => (aufruf.method === "PUT" ? 0 : 201));
    await schlange.aufnehmen(TOM, "kommen");
    expect(await schlange.uebertragen(TOM, 1)).toEqual({ uebertragen: 0, wartend: 1 });
    expect(aufrufe.map((a) => a.method)).toEqual(["PUT"]);
  });

  it("sends only the entries of the person signed in", async () => {
    const { schlange, aufrufe } = aufbau();
    await schlange.aufnehmen("elbblick/lea", "kommen");
    expect(await schlange.uebertragen(TOM)).toEqual({ uebertragen: 0, wartend: 0 });
    expect(aufrufe).toEqual([]);
    expect(await schlange.eintraege("elbblick/lea")).toHaveLength(1);
  });

  it("keeps the time of the tap while the queue is still busy sending", async () => {
    const { schlange, stelleUhr, anhalten } = aufbau();
    await schlange.aufnehmen(TOM, "kommen");
    const weiter = anhalten();
    const senden = schlange.uebertragen(TOM);
    stelleUhr(um("12:00"));
    const tippen = schlange.aufnehmen(TOM, "pause_beginn");
    // the network answers minutes later
    await Promise.resolve();
    stelleUhr(um("12:05"));
    weiter();
    await senden;
    expect(await tippen).toMatchObject({ nummer: 2, geraetZeitpunkt: um("12:00") });
  });

  it("sends a stamp whose turn comes long after the tap as an offline entry, not live", async () => {
    const { schlange, aufrufe, stelleUhr, anhalten } = aufbau();
    await schlange.aufnehmen(TOM, "kommen");
    stelleUhr(um("12:00"));
    const zwei = await schlange.aufnehmen(TOM, "pause_beginn");
    const weiter = anhalten();
    const senden = schlange.uebertragen(TOM, zwei.nummer);
    // the first entry hangs on a slow network for five minutes
    await new Promise((fertig) => setTimeout(fertig, 0));
    stelleUhr(um("12:05"));
    weiter();
    await senden;
    const letzter = aufrufe.at(-1);
    expect(letzter?.pfad).toBe("/api/v1/arbeitszeit/stempelungen/offline");
    expect(letzter?.body).toMatchObject({ geraetZeitpunkt: um("12:00"), gesendetAm: um("12:05") });
  });
});
