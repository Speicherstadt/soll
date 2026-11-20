import { describe, expect, it } from "vitest";
import {
  betriebMitTerminal,
  gekoppelt,
  JETZT,
  json,
  neuerServer,
  pinSetzen,
} from "./terminal-testhilfen.ts";

/*
 * Guessing PINs at the terminal (review of S-801): with the PIN alone identifying a person, every PIN
 * in the business is a target of each guess, so what the lock lets through in a day decides how
 * likely a falsified stamp in someone else's name is (docs/plan.md, "Sperre am Terminal").
 */
describe("guessing PINs at the terminal (S-801)", { timeout: 60_000 }, () => {
  it("does not let one's own PIN between guesses lift the lock", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const versuch = (pin: string) => geraet.anfrage("/api/v1/kiosk/erkennen", { body: { pin } });
    const antworten: number[] = [];
    // an employee guesses four PINs, then types their own, and again, a hundred guesses in all
    for (let runde = 0; runde < 25; runde++) {
      for (let i = 0; i < 4; i++)
        antworten.push((await versuch(String(100000 + runde * 4 + i))).status);
      antworten.push((await versuch("471100")).status);
    }
    expect(antworten).toContain(423);
  });

  it("compares at most twenty wrong PINs a day", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const tagesende = JETZT + 24 * 60 * 60_000;
    let uhr = JETZT;
    let verglichen = 0;
    // each time the terminal is locked, wait until it opens again, then guess on
    while (uhr < tagesende && verglichen <= 100) {
      const { gesperrtBis } = await json(await geraet.anfrage("/api/v1/kiosk"));
      if (typeof gesperrtBis === "number") {
        uhr = gesperrtBis;
        server.stelleUhr(uhr);
        continue;
      }
      const antwort = await geraet.anfrage("/api/v1/kiosk/erkennen", {
        body: { pin: String(200000 + verglichen) },
      });
      expect([401, 423]).toContain(antwort.status);
      verglichen++;
    }
    expect(verglichen).toBeLessThanOrEqual(20);
  });

  it("takes only PINs of six to eight digits", async () => {
    const server = neuerServer();
    const { inhaber, mitarbeiterin } = await betriebMitTerminal(server);
    expect((await pinSetzen(inhaber, mitarbeiterin.nutzerId, "4712")).status).toBe(400);
    expect((await pinSetzen(inhaber, mitarbeiterin.nutzerId, "47120")).status).toBe(400);
    expect((await pinSetzen(inhaber, mitarbeiterin.nutzerId, "471200")).status).toBe(204);
    expect((await pinSetzen(inhaber, mitarbeiterin.nutzerId, "47120000")).status).toBe(204);
  });
});
