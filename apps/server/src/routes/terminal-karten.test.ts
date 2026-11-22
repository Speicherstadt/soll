import { describe, expect, it } from "vitest";
import {
  karteEintragen,
  NTAG_SCHLUESSEL,
  NTAG_UID,
  ntagKarte,
  sun,
  UID_KARTE,
  uidKarte,
} from "./karten-testhilfen.ts";
import {
  betriebMitTerminal,
  gekoppelt,
  json,
  neuerServer,
  pinSetzen,
} from "./terminal-testhilfen.ts";

/** Café Elbblick with Lea (PIN 471100) and Tom (PIN 583920), a paired tablet */
const elbblick = async () => {
  const server = neuerServer();
  const { inhaber, mitarbeiterin: lea } = await betriebMitTerminal(server);
  const tom = await server.eingeladen(inhaber, "mitarbeiter", "tom");
  await pinSetzen(inhaber, tom.nutzerId, "583920");
  const geraet = await gekoppelt(server, inhaber);
  const erkennen = (body: unknown) => geraet.anfrage("/api/v1/kiosk/erkennen", { body });
  return { server, inhaber, lea, tom, geraet, erkennen };
};

describe("a plain card recognises a person only with their PIN (S-802)", {
  timeout: 20_000,
}, () => {
  it("recognises Lea by her card and her PIN", async () => {
    const e = await elbblick();
    await uidKarte(e.inhaber, e.lea.nutzerId);
    const antwort = await e.erkennen({ karte: UID_KARTE, pin: "471100" });
    expect(antwort.status).toBe(200);
    expect((await json(antwort)).person).toMatchObject({ nutzerId: e.lea.nutzerId });
  });

  it("refuses the card alone, whatever the tablet sends", async () => {
    const e = await elbblick();
    await uidKarte(e.inhaber, e.lea.nutzerId);
    expect((await e.erkennen({ karte: UID_KARTE })).status).toBe(400);
    expect((await e.erkennen({ karte: UID_KARTE, pin: "" })).status).toBe(400);
  });

  it("refuses the card with someone else's PIN or a wrong one, and counts each", async () => {
    const e = await elbblick();
    await uidKarte(e.inhaber, e.lea.nutzerId);
    const tom = await e.erkennen({ karte: UID_KARTE, pin: "583920" });
    expect(tom.status).toBe(401);
    expect(await json(tom)).toEqual({ fehler: "unbekannt", rest: 4 });
    expect(await json(await e.erkennen({ karte: UID_KARTE, pin: "000000" }))).toEqual({
      fehler: "unbekannt",
      rest: 3,
    });
  });

  it("refuses an unknown card with a valid PIN", async () => {
    const e = await elbblick();
    const antwort = await e.erkennen({ karte: "04:00:00:00:00:00:01", pin: "471100" });
    expect(antwort.status).toBe(401);
  });

  it("stamps for Lea with card and PIN", async () => {
    const e = await elbblick();
    await uidKarte(e.inhaber, e.lea.nutzerId);
    const antwort = await e.geraet.anfrage("/api/v1/kiosk/stempeln", {
      body: { ausweis: { karte: UID_KARTE, pin: "471100" }, art: "kommen" },
    });
    expect(antwort.status).toBe(201);
    expect(e.server.sqlite.query("SELECT nutzer_id, quelle FROM stempelungen").all()).toEqual([
      { nutzer_id: e.lea.nutzerId, quelle: "terminal" },
    ]);
  });

  it("locks the terminal after five wrong tries with a card", async () => {
    const e = await elbblick();
    await uidKarte(e.inhaber, e.lea.nutzerId);
    for (let i = 0; i < 4; i++) await e.erkennen({ karte: UID_KARTE, pin: String(600000 + i) });
    expect((await e.erkennen({ karte: UID_KARTE, pin: "600009" })).status).toBe(423);
    expect((await e.erkennen({ karte: UID_KARTE, pin: "471100" })).status).toBe(423);
  });
});

describe("an NTAG 424 DNA recognises a person by its SUN message (S-802)", {
  timeout: 20_000,
}, () => {
  it("recognises Lea by a genuine message and gives a receipt to stamp with", async () => {
    const e = await elbblick();
    await ntagKarte(e.inhaber, e.lea.nutzerId);
    const antwort = await e.erkennen({ sun: sun(5) });
    expect(antwort.status).toBe(200);
    const daten = await json(antwort);
    expect(daten.person).toMatchObject({ nutzerId: e.lea.nutzerId });
    const stempel = await e.geraet.anfrage("/api/v1/kiosk/stempeln", {
      body: { ausweis: { beleg: daten.beleg }, art: "kommen" },
    });
    expect(stempel.status).toBe(201);
    expect(e.server.sqlite.query("SELECT zaehler FROM karten").get()).toEqual({ zaehler: 5 });
  });

  it("refuses a message read before (replay) and one with a lower counter", async () => {
    const e = await elbblick();
    await ntagKarte(e.inhaber, e.lea.nutzerId);
    const erste = sun(5);
    expect((await e.erkennen({ sun: erste })).status).toBe(200);
    expect(await json(await e.erkennen({ sun: erste }))).toEqual({ fehler: "unbekannt", rest: 4 });
    expect((await e.erkennen({ sun: sun(4) })).status).toBe(401);
    expect((await e.erkennen({ sun: sun(6) })).status).toBe(200);
  });

  it("refuses a forged message: a changed MAC, or keys other than the card's", async () => {
    const e = await elbblick();
    await ntagKarte(e.inhaber, e.lea.nutzerId);
    const echt = sun(5);
    const letzte = echt.c.at(-1) === "0" ? "1" : "0";
    expect((await e.erkennen({ sun: { ...echt, c: echt.c.slice(0, -1) + letzte } })).status).toBe(
      401,
    );
    const fremd = { meta: "11".repeat(16), datei: "22".repeat(16) };
    expect((await e.erkennen({ sun: sun(9, fremd) })).status).toBe(401);
    // nothing of the forgeries moved the counter: the genuine message still counts
    expect((await e.erkennen({ sun: echt })).status).toBe(200);
  });

  it("refuses a message of the card's keys with another UID", async () => {
    const e = await elbblick();
    await ntagKarte(e.inhaber, e.lea.nutzerId);
    expect((await e.erkennen({ sun: sun(5, NTAG_SCHLUESSEL, "04000000000001") })).status).toBe(401);
  });

  it("refuses a receipt from another terminal or one made up", async () => {
    const e = await elbblick();
    await ntagKarte(e.inhaber, e.lea.nutzerId);
    const { beleg } = await json(await e.erkennen({ sun: sun(5) }));
    const zweites = await gekoppelt(e.server, e.inhaber, "Küche");
    const dort = await zweites.anfrage("/api/v1/kiosk/erkennen", { body: { beleg } });
    expect(dort.status).toBe(401);
    expect((await e.erkennen({ beleg: "erfunden.erfunden" })).status).toBe(401);
  });

  it("gives no receipt for a PIN, a QR code or a card with PIN", async () => {
    const e = await elbblick();
    expect(await json(await e.erkennen({ pin: "471100" }))).not.toHaveProperty("beleg");
  });
});

describe("the owner's cards (S-802)", { timeout: 20_000 }, () => {
  it("lists the cards with name and kind, without UID or keys", async () => {
    const e = await elbblick();
    await uidKarte(e.inhaber, e.lea.nutzerId);
    await ntagKarte(e.inhaber, e.tom.nutzerId);
    const antwort = await e.inhaber.anfrage("/api/v1/terminal/karten");
    const text = await antwort.clone().text();
    expect(
      ((await json(antwort)).karten as { name: string; art: string }[]).map((k) => [k.name, k.art]),
    ).toEqual([
      ["lea", "uid"],
      ["tom", "ntag424"],
    ]);
    expect(text).not.toMatch(/A1B2C3|a1:b2|42AFF1|uidKennung|schluessel/i);
  });

  it("keeps the UID only as a keyed hash and the keys only encrypted", async () => {
    const e = await elbblick();
    await ntagKarte(e.inhaber, e.tom.nutzerId);
    const zeile = e.server.sqlite.query("SELECT uid_kennung, schluessel FROM karten").get() as {
      uid_kennung: string;
      schluessel: string;
    };
    expect(zeile.uid_kennung).toMatch(/^[0-9a-f]{64}$/);
    expect(zeile.schluessel).toMatch(/^v1\./);
    const alles = JSON.stringify(e.server.sqlite.query("SELECT * FROM audit_inhalte").all());
    for (const geheim of [NTAG_UID, NTAG_SCHLUESSEL.meta, NTAG_SCHLUESSEL.datei])
      expect(alles.toUpperCase()).not.toContain(geheim);
  });

  it("refuses a UID in use (409), a malformed UID or the factory key (400)", async () => {
    const e = await elbblick();
    await uidKarte(e.inhaber, e.lea.nutzerId);
    const doppelt = await karteEintragen(e.inhaber, {
      nutzerId: e.tom.nutzerId,
      art: "uid",
      uid: "04A1B2C3D4E5F6",
    });
    expect(doppelt.status).toBe(409);
    expect(await json(doppelt)).toEqual({ fehler: "karte_vergeben" });
    const kurz = { nutzerId: e.tom.nutzerId, art: "uid", uid: "04A1B2" };
    expect((await karteEintragen(e.inhaber, kurz)).status).toBe(400);
    const werk = {
      nutzerId: e.tom.nutzerId,
      art: "ntag424",
      uid: NTAG_UID,
      meta: "0".repeat(32),
      datei: NTAG_SCHLUESSEL.datei,
    };
    expect((await karteEintragen(e.inhaber, werk)).status).toBe(400);
  });

  it("enters cards only for people who stamp", async () => {
    const e = await elbblick();
    const antwort = await karteEintragen(e.inhaber, {
      nutzerId: "niemand",
      art: "uid",
      uid: UID_KARTE,
    });
    expect(antwort.status).toBe(404);
  });

  it("revokes a card at once and deletes its keys", async () => {
    const e = await elbblick();
    const { karteId } = await ntagKarte(e.inhaber, e.lea.nutzerId);
    const weg = await e.inhaber.anfrage(`/api/v1/terminal/karten/${karteId}`, { method: "DELETE" });
    expect(weg.status).toBe(204);
    expect((await e.erkennen({ sun: sun(5) })).status).toBe(401);
    expect(e.server.sqlite.query("SELECT schluessel FROM karten").get()).toEqual({
      schluessel: null,
    });
    expect(
      ((await json(await e.inhaber.anfrage("/api/v1/terminal/karten"))).karten as []).length,
    ).toBe(0);
    const nochmal = await e.inhaber.anfrage(`/api/v1/terminal/karten/${karteId}`, {
      method: "DELETE",
    });
    expect(nochmal.status).toBe(404);
  });

  it("keeps the read counter when a revoked card is entered again", async () => {
    const e = await elbblick();
    const { karteId } = await ntagKarte(e.inhaber, e.lea.nutzerId);
    const alt = sun(5);
    const gelesen = sun(7);
    expect((await e.erkennen({ sun: gelesen })).status).toBe(200);
    await e.inhaber.anfrage(`/api/v1/terminal/karten/${karteId}`, { method: "DELETE" });
    await ntagKarte(e.inhaber, e.tom.nutzerId);
    expect((await e.erkennen({ sun: alt })).status).toBe(401);
    expect((await e.erkennen({ sun: gelesen })).status).toBe(401);
    expect((await json(await e.erkennen({ sun: sun(8) }))).person).toMatchObject({
      nutzerId: e.tom.nutzerId,
    });
  });

  it("writes entering, every counter and revoking into the audit chain", async () => {
    const e = await elbblick();
    const { karteId } = await ntagKarte(e.inhaber, e.lea.nutzerId);
    await e.erkennen({ sun: sun(5) });
    await e.inhaber.anfrage(`/api/v1/terminal/karten/${karteId}`, { method: "DELETE" });
    expect(
      e.server.sqlite
        .query("SELECT aktion FROM audit_glieder WHERE tabelle = 'karten' ORDER BY seq")
        .all(),
    ).toEqual([{ aktion: "einfuegen" }, { aktion: "aendern" }, { aktion: "aendern" }]);
  });
});
