import { describe, expect, it } from "vitest";
import { schreiben } from "../modules/audit/index.ts";
import {
  betriebMitTerminal,
  gekoppelt,
  JETZT,
  json,
  neuerServer,
  pinSetzen,
} from "./terminal-testhilfen.ts";

/*
 * The lock of the terminal, second review of S-801: PINs from before S-801, parallel tries, QR codes
 * in the same count, and what the owner can do about a lock until midnight.
 */
/** Twenty wrong PINs, waiting out each short lock: the terminal is locked until midnight */
const bisMitternachtGesperrt = async (
  server: ReturnType<typeof neuerServer>,
  geraet: Awaited<ReturnType<typeof gekoppelt>>,
) => {
  for (let i = 0; i < 20; i++) {
    const { gesperrtBis } = await json(await geraet.anfrage("/api/v1/kiosk"));
    if (typeof gesperrtBis === "number") server.stelleUhr(gesperrtBis);
    await geraet.anfrage("/api/v1/kiosk/erkennen", { body: { pin: String(500000 + i) } });
  }
};

const MITTERNACHT = Date.parse("2026-11-21T00:00:00+01:00");

describe("lock of the terminal, second review (S-801)", { timeout: 60_000 }, () => {
  it("does not recognise a four-digit PIN from before S-801 until the owner sets a new one", async () => {
    const server = neuerServer();
    const { inhaber, mitarbeiterin } = await betriebMitTerminal(server);
    const kontext = { betriebId: inhaber.betriebId, akteur: inhaber.nutzerId, jetzt: JETZT };
    // a PIN as S-106 stored it: four digits, an Argon2id hash and no keyed hash
    const pinHash = await Bun.password.hash("4712", { algorithm: "argon2id" });
    schreiben(server.schreibDb, kontext, (s) =>
      s.aendern(
        "pins",
        { nutzerId: mitarbeiterin.nutzerId },
        { pinHash, pinKennung: null, fehlversuche: 0, gesperrt: false },
      ),
    );
    const geraet = await gekoppelt(server, inhaber);
    const erkennen = (pin: string) => geraet.anfrage("/api/v1/kiosk/erkennen", { body: { pin } });
    expect((await erkennen("4712")).status).toBe(401);
    // resetting it takes six digits at least, and then the terminal knows the person
    expect((await pinSetzen(inhaber, mitarbeiterin.nutzerId, "4712")).status).toBe(400);
    expect((await pinSetzen(inhaber, mitarbeiterin.nutzerId, "583920")).status).toBe(204);
    expect((await erkennen("583920")).status).toBe(200);
  });

  it("counts wrong tries that arrive at once", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const antworten = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        geraet.anfrage("/api/v1/kiosk/erkennen", { body: { pin: String(300000 + i) } }),
      ),
    );
    expect(antworten.map((a) => a.status).sort()).toEqual([401, 401, 401, 401, 423]);
    expect((await json(await geraet.anfrage("/api/v1/kiosk"))).gesperrtBis).toBe(JETZT + 60_000);
  });

  it("counts wrong QR codes and wrong PINs together", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    const erkennen = (body: unknown) => geraet.anfrage("/api/v1/kiosk/erkennen", { body });
    for (let i = 0; i < 2; i++) await erkennen({ pin: String(400000 + i) });
    for (let i = 0; i < 2; i++) await erkennen({ qr: `soll-ausweis:falsch-${i}` });
    expect((await erkennen({ qr: "soll-ausweis:falsch-9" })).status).toBe(423);
  });

  it("shows the owner a lock until midnight in the list of terminals", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    await bisMitternachtGesperrt(server, geraet);
    const { terminals } = (await json(await inhaber.anfrage("/api/v1/terminal/geraete"))) as {
      terminals: { terminalId: string; gesperrtBis: number | null }[];
    };
    expect(terminals.find((t) => t.terminalId === geraet.terminalId)?.gesperrtBis).toBe(
      MITTERNACHT,
    );
  });

  it("lets the owner lift a lock without pairing anew, and five more wrong PINs lock again until midnight", async () => {
    const server = neuerServer();
    const { inhaber } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    await bisMitternachtGesperrt(server, geraet);
    const entsperren = await inhaber.anfrage(
      `/api/v1/terminal/geraete/${geraet.terminalId}/entsperren`,
      { body: {} },
    );
    expect(entsperren.status).toBe(204);
    expect((await json(await geraet.anfrage("/api/v1/kiosk"))).gesperrtBis).toBeNull();
    const erkennen = (pin: string) => geraet.anfrage("/api/v1/kiosk/erkennen", { body: { pin } });
    expect((await erkennen("471100")).status).toBe(200);
    // lifting the lock does not hand out another day of guesses
    for (let i = 0; i < 4; i++) expect((await erkennen(String(600000 + i))).status).toBe(401);
    const fuenfter = await erkennen("600004");
    expect(fuenfter.status).toBe(423);
    expect((await json(fuenfter)).gesperrtBis).toBe(MITTERNACHT);
    // the owner stands in the audit chain as the one who lifted it
    expect(
      server.sqlite
        .query("SELECT akteur FROM audit_glieder WHERE tabelle = 'terminals' ORDER BY rowid DESC")
        .all()
        .map((z) => (z as { akteur: string }).akteur),
    ).toContain(inhaber.nutzerId);
  });

  it("lets only the owner lift a lock", async () => {
    const server = neuerServer();
    const { inhaber, mitarbeiterin } = await betriebMitTerminal(server);
    const geraet = await gekoppelt(server, inhaber);
    await bisMitternachtGesperrt(server, geraet);
    const pfad = `/api/v1/terminal/geraete/${geraet.terminalId}/entsperren`;
    expect((await mitarbeiterin.anfrage(pfad, { body: {} })).status).toBe(403);
    expect(
      (await inhaber.anfrage("/api/v1/terminal/geraete/unbekannt/entsperren", { body: {} })).status,
    ).toBe(404);
    expect((await json(await geraet.anfrage("/api/v1/kiosk"))).gesperrtBis).toBe(MITTERNACHT);
  });
});
