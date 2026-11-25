import { describe, expect, it } from "vitest";
import type { Antwort } from "../../api.ts";
import { kioskAblageImSpeicher } from "./ablage.ts";
import { kioskSchlange } from "./dienst.ts";

const TERMINAL = "0b7c2f1e-1d4f-4c7e-9a43-2c1f0e9b7d10";

describe("review of S-803: the queue while the server does not answer", () => {
  it("takes a new stamp while a send hangs on a server that does not answer", async () => {
    const paar = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ]);
    const jwk = await crypto.subtle.exportKey("jwk", paar.publicKey);
    const server = { kty: "EC", crv: "P-256", x: jwk.x ?? "", y: jwk.y ?? "" };
    let kette: Promise<unknown> = Promise.resolve();
    const schlange = kioskSchlange({
      ablage: kioskAblageImSpeicher(),
      subtle: crypto.subtle,
      jetzt: () => Date.parse("2026-11-20T07:58:00+01:00"),
      // one at a time, as Web Locks in the browser
      sperre: (arbeit) => {
        const lauf = kette.then(arbeit, arbeit);
        kette = lauf.catch(() => undefined);
        return lauf;
      },
      // the key is registered; then the network hangs (Wi-Fi up, server out of reach): fetch has no
      // timeout and stays pending for minutes
      api: (pfad) =>
        pfad === "/api/v1/kiosk/schluessel"
          ? Promise.resolve({ ok: true, status: 201, daten: {} } as Antwort<unknown>)
          : new Promise<Antwort<unknown>>(() => undefined),
    });
    await schlange.vorbereiten("token", TERMINAL, server);
    await schlange.aufnehmen(TERMINAL, { pin: "471100" }, "kommen");
    // the kiosk sends after each new entry (warteschlange.ts) and every 30 seconds
    void schlange.uebertragen("token", TERMINAL);
    // the next person taps Kommen offline: the stamp should be kept at once
    const naechste = schlange.aufnehmen(TERMINAL, { pin: "220900" }, "kommen");
    const ergebnis = await Promise.race([
      naechste.then(() => "gespeichert"),
      new Promise((fertig) => setTimeout(() => fertig("haengt"), 1000)),
    ]);
    expect(ergebnis).toBe("gespeichert");
  });
});
