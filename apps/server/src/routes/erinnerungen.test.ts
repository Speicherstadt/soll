import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { testAbo } from "../modules/erinnerungen/push-test.ts";
import { testServer } from "../test-server.ts";
import { cafe, PFAD } from "./erinnerungen-testhilfen.ts";

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

describe("reminder settings (S-307)", () => {
  it("shows the defaults, the public VAPID key and whether mail can reach the person", async () => {
    const c = await cafe();
    expect(await json(await c.tom.anfrage(PFAD))).toEqual({
      vapidSchluessel: c.server.vapid.oeffentlich,
      wuensche: { ausstempeln: true, pause: true, monat: true, mail: true },
      regeln: { gehenMinuten: 600, pauseVorlauf: 15, monatTag: 1 },
      // invited without an e-mail address
      mail: false,
      geraete: 0,
    });
    expect((await json(await c.mia.anfrage(PFAD))).mail).toBe(true);
  });

  it("keeps each person's wishes for themselves, in the audit chain", async () => {
    const c = await cafe();
    const aus = { ausstempeln: false, pause: true, monat: false, mail: true };
    expect(
      await json(await c.tom.anfrage(`${PFAD}/wuensche`, { method: "PUT", body: aus })),
    ).toEqual(aus);
    expect((await json(await c.tom.anfrage(PFAD))).wuensche).toEqual(aus);
    expect((await json(await c.mia.anfrage(PFAD))).wuensche).toMatchObject({ ausstempeln: true });
    const wieder = { ...aus, pause: false };
    await c.tom.anfrage(`${PFAD}/wuensche`, { method: "PUT", body: wieder });
    expect((await json(await c.tom.anfrage(PFAD))).wuensche).toEqual(wieder);
    for (const falsch of [
      { ...aus, mail: "ja" },
      { ausstempeln: true },
      { ...aus, nutzerId: c.mia.nutzerId },
    ]) {
      expect(
        (await c.tom.anfrage(`${PFAD}/wuensche`, { method: "PUT", body: falsch })).status,
      ).toBe(400);
    }
    expect(kettePruefen(c.server.db, c.mia.betriebId)).toEqual([]);
  });

  it("lets only the owner set the business's times, within their limits", async () => {
    const c = await cafe();
    const regeln = { gehenMinuten: 540, pauseVorlauf: 10, monatTag: 5 };
    expect((await c.tom.anfrage(`${PFAD}/regeln`, { method: "PUT", body: regeln })).status).toBe(
      403,
    );
    expect(
      await json(await c.mia.anfrage(`${PFAD}/regeln`, { method: "PUT", body: regeln })),
    ).toEqual(regeln);
    expect((await json(await c.tom.anfrage(PFAD))).regeln).toEqual(regeln);
    for (const falsch of [
      { ...regeln, gehenMinuten: 30 },
      { ...regeln, gehenMinuten: 961 },
      { ...regeln, pauseVorlauf: -1 },
      { ...regeln, monatTag: 29 },
      { ...regeln, monatTag: 1.5 },
    ]) {
      expect((await c.mia.anfrage(`${PFAD}/regeln`, { method: "PUT", body: falsch })).status).toBe(
        400,
      );
    }
  });

  it("is not there for external staff, who do not stamp", async () => {
    const c = await cafe();
    const extern = await c.server.eingeladen(c.mia, "extern", "steuer");
    expect((await extern.anfrage(PFAD)).status).toBe(403);
  });

  it("is refused while working time is switched off", async () => {
    const server = testServer();
    const solo = await server.inhaberMitBetrieb("Lotsenbüro", "lotse");
    await solo.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { arbeitszeit: false } });
    const abo = testAbo("https://push.example.test/solo").json;
    const routen: [string, string, unknown?][] = [
      ["GET", PFAD],
      ["PUT", `${PFAD}/wuensche`, { ausstempeln: true, pause: true, monat: true, mail: true }],
      ["PUT", `${PFAD}/regeln`, { gehenMinuten: 600, pauseVorlauf: 15, monatTag: 1 }],
      ["POST", `${PFAD}/abos`, { ...abo, sprache: "de" }],
      ["DELETE", `${PFAD}/abos`, { endpoint: abo.endpoint }],
    ];
    for (const [method, pfad, body] of routen) {
      const antwort = await solo.anfrage(pfad, { method, body });
      expect(antwort.status, `${method} ${pfad}`).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "modul_aus", modul: "arbeitszeit" });
    }
  });
});

describe("devices for Web Push", () => {
  it("registers a device once, keeps the subscription encrypted and unregisters it", async () => {
    const c = await cafe();
    const { geraet, antwort } = await c.abonnieren(c.tom, "tom");
    expect(antwort.status).toBe(201);
    expect(
      (await c.tom.anfrage(`${PFAD}/abos`, { body: { ...geraet.json, sprache: "pl" } })).status,
    ).toBe(200);
    expect((await json(await c.tom.anfrage(PFAD))).geraete).toBe(1);
    const roh = JSON.stringify(c.server.sqlite.query("SELECT * FROM push_abos").all());
    const inhalte = JSON.stringify(c.server.sqlite.query("SELECT * FROM audit_inhalte").all());
    for (const geheim of [geraet.json.endpoint, geraet.json.keys.auth, geraet.json.keys.p256dh]) {
      expect(roh).not.toContain(geheim);
      expect(inhalte).not.toContain(geheim);
    }
    expect(roh).toContain('"sprache":"pl"');
    const weg = await c.tom.anfrage(`${PFAD}/abos`, {
      method: "DELETE",
      body: { endpoint: geraet.json.endpoint },
    });
    expect(weg.status).toBe(204);
    expect((await json(await c.tom.anfrage(PFAD))).geraete).toBe(0);
    expect(kettePruefen(c.server.db, c.mia.betriebId)).toEqual([]);
  });

  it("refuses a key off P-256, a short auth secret, plain http and the server's own network", async () => {
    const c = await cafe();
    const gut = testAbo("https://push.example.test/tom").json;
    const kaputt = Buffer.from(gut.keys.p256dh, "base64url");
    kaputt[64] = (kaputt[64] ?? 0) ^ 1;
    const falsch = [
      { ...gut, keys: { ...gut.keys, p256dh: kaputt.toString("base64url") } },
      { ...gut, keys: { ...gut.keys, auth: "AAAA" } },
      { ...gut, endpoint: "http://push.example.test/tom" },
      { ...gut, endpoint: "https://127.0.0.1/push" },
      { ...gut, endpoint: "https://localhost/push" },
      { ...gut, endpoint: "https://intern/push" },
    ];
    for (const abo of falsch) {
      const antwort = await c.tom.anfrage(`${PFAD}/abos`, { body: { ...abo, sprache: "de" } });
      expect(antwort.status, JSON.stringify(abo)).toBe(400);
    }
    expect((await c.tom.anfrage(`${PFAD}/abos`, { body: { ...gut, sprache: "fr" } })).status).toBe(
      400,
    );
    expect(c.server.sqlite.query("SELECT * FROM push_abos").all()).toEqual([]);
  });

  it("moves a shared device to the person who subscribed last; nobody unregisters another's", async () => {
    const c = await cafe();
    const { geraet } = await c.abonnieren(c.tom, "geteilt");
    const endpoint = geraet.json.endpoint;
    expect(
      (await c.mia.anfrage(`${PFAD}/abos`, { method: "DELETE", body: { endpoint } })).status,
    ).toBe(404);
    expect((await json(await c.tom.anfrage(PFAD))).geraete).toBe(1);
    expect(
      (await c.mia.anfrage(`${PFAD}/abos`, { body: { ...geraet.json, sprache: "de" } })).status,
    ).toBe(201);
    expect((await json(await c.tom.anfrage(PFAD))).geraete).toBe(0);
    expect((await json(await c.mia.anfrage(PFAD))).geraete).toBe(1);
  });
});
