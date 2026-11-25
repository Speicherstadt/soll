import { describe, expect, it } from "vitest";
import type { Antwort } from "../../api.ts";
import { kioskAblageImSpeicher } from "./ablage.ts";
import { kioskSchlange } from "./dienst.ts";

const TERMINAL = "0b7c2f1e-1d4f-4c7e-9a43-2c1f0e9b7d10";

describe("review of S-803, round 3: sending first before a SUN tap", () => {
  it("has sent every entry stored before the call once uebertragen resolves", async () => {
    const paar = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ]);
    const jwk = await crypto.subtle.exportKey("jwk", paar.publicKey);
    const server = { kty: "EC", crv: "P-256", x: jwk.x ?? "", y: jwk.y ?? "" };
    let kette: Promise<unknown> = Promise.resolve();
    const gesendet: number[] = [];
    let ersteFreigeben: () => void = () => undefined;
    const ersteHaengt = new Promise<void>((fertig) => {
      ersteFreigeben = fertig;
    });
    const schlange = kioskSchlange({
      ablage: kioskAblageImSpeicher(),
      subtle: crypto.subtle,
      jetzt: () => Date.parse("2026-11-20T07:58:00+01:00"),
      sperre: (arbeit) => {
        const lauf = kette.then(arbeit, arbeit);
        kette = lauf.catch(() => undefined);
        return lauf;
      },
      api: async (pfad, init) => {
        if (pfad === "/api/v1/kiosk/schluessel")
          return { ok: true, status: 201, daten: {} } as Antwort<unknown>;
        const nummer = (init.body as { nummer: number }).nummer;
        // the first entry's answer is slow (the network just came back)
        if (nummer === 1) await ersteHaengt;
        gesendet.push(nummer);
        return { ok: true, status: 201, daten: {} } as Antwort<unknown>;
      },
    });
    await schlange.vorbereiten("token", TERMINAL, server);
    await schlange.aufnehmen(TERMINAL, { pin: "220900" }, "kommen");
    // the 30-second run starts and waits on entry 1
    const lauf = schlange.uebertragen("token", TERMINAL);
    // meanwhile Lea's card is read without an answer: her SUN entry 2 waits
    await schlange.aufnehmen(TERMINAL, { sun: { picc_data: "aa", cmac: "bb" } } as never, "kommen");
    // Lea taps again with network: zuerstSenden -> uebertragen, then /erkennen with a higher counter
    const zuerst = schlange.uebertragen("token", TERMINAL);
    ersteFreigeben();
    await Promise.all([lauf, zuerst]);
    // by now entry 2 must be with the server, or /erkennen makes it a replay
    expect(gesendet).toEqual([1, 2]);
  });
});
