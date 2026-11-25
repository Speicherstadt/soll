import { describe, expect, it } from "vitest";
import { kettePruefen, sha256 } from "../modules/audit/index.ts";
import { TEST_URL, testServer } from "../test-server.ts";
import {
  type Browser,
  elbblick,
  json,
  planen,
  schichtVon,
  veroeffentlichen,
} from "./dienstplan-testhilfen.ts";
import { mitgliedId, mitToken, tokenVon } from "./zugaenge-testhilfen.ts";

/* The calendar feed of a person (S-503), after RFC 5545 */

const KALENDER = "/api/v1/dienstplan/kalender";

const ausstellen = async (wer: Browser, sprache = "de") => {
  const antwort = await wer.anfrage(KALENDER, { body: { sprache } });
  expect(antwort.status).toBe(201);
  return (await json(antwort)) as { url: string; abo: { angelegtAm: number; sprache: string } };
};

/** What a calendar app gets: no cookie, no token but the one in the link */
const abrufen = (server: ReturnType<typeof testServer>, url: string) =>
  server.app.request(url, { headers: { cookie: "" } });

/** The values of a property in the unfolded content lines (RFC 5545, 3.1) */
const werte = (ics: string, name: string) =>
  ics
    .replaceAll("\r\n ", "")
    .split("\r\n")
    .filter((zeile) => zeile.startsWith(`${name}:`))
    .map((zeile) => zeile.slice(name.length + 1));

/** Café Elbblick with Tom's shift and an open one published, Mia's and a draft of Tom's not */
const mitPlan = async (server = testServer()) => {
  const c = await elbblick(server);
  const tom = await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId));
  await planen(c.lea, schichtVon(c.standortId, null, "2026-11-24"));
  await planen(c.lea, schichtVon(c.standortId, c.mia.nutzerId, "2026-11-25"));
  await veroeffentlichen(c.lea, c.standortId);
  const entwurf = await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId, "2026-11-26"));
  return { ...c, schichtId: tom.schichtId as string, entwurfId: entwurf.schichtId as string };
};

describe("the calendar feed", () => {
  it("holds only the person's own published shifts as RFC 5545, read-only", async () => {
    const c = await mitPlan();
    const { url, abo } = await ausstellen(c.tom, "de");
    expect(url).toMatch(/^http:\/\/localhost:28200\/api\/v1\/ics\/soll_ics_[\w-]{43}\.ics$/);
    expect(abo).toEqual({ angelegtAm: c.server.jetzt(), sprache: "de" });
    expect(await json(await c.tom.anfrage(KALENDER))).toEqual({ abo });
    const antwort = await abrufen(c.server, url);
    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(antwort.headers.get("cache-control")).toBe("private, no-store");
    const ics = await antwort.text();
    // RFC 5545, 3.4 and 3.1: one VCALENDAR, CRLF only
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
    // 3.8.4.7: the shift's id, no draft, nobody else's shift, no open one
    expect(werte(ics, "UID")).toEqual([c.schichtId]);
    expect(werte(ics, "SUMMARY")).toEqual(["Schicht · Service"]);
    expect(werte(ics, "LOCATION")).toEqual(["Elbe"]);
    expect(werte(ics, "DESCRIPTION")).toEqual(["Pause: 30 min"]);
    expect(werte(ics, "X-WR-CALNAME")).toEqual(["Soll · Café Elbblick"]);
    // 3.3.5: 14:00 to 22:00 in Hamburg in November is 13:00Z to 21:00Z
    expect(werte(ics, "DTSTART")).toEqual(["20261123T130000Z"]);
    expect(werte(ics, "DTEND")).toEqual(["20261123T210000Z"]);
    // read-only: no other method reaches the feed (without a session the API answers 401)
    for (const methode of ["POST", "PUT", "DELETE"])
      expect((await c.server.app.request(url, { method: methode })).status).toBe(401);
    expect((await abrufen(c.server, url)).status).toBe(200);
  });

  it("follows a change with LAST-MODIFIED and SEQUENCE, the UID stays (3.8.7, 3.8.4.7)", async () => {
    const c = await mitPlan();
    const { url } = await ausstellen(c.tom);
    const vorher = await (await abrufen(c.server, url)).text();
    // created, then published: one revision
    expect(werte(vorher, "SEQUENCE")).toEqual(["1"]);
    c.server.stelleUhr(Date.parse("2026-11-20T08:30:00Z"));
    await c.lea.anfrage(`/api/v1/dienstplan/schichten/${c.schichtId}`, {
      method: "PATCH",
      body: { beginnMinute: 15 * 60 },
    });
    const nachher = await (await abrufen(c.server, url)).text();
    expect(werte(nachher, "UID")).toEqual([c.schichtId]);
    expect(werte(nachher, "SEQUENCE")).toEqual(["2"]);
    expect(werte(nachher, "LAST-MODIFIED")).toEqual(["20261120T083000Z"]);
    expect(werte(nachher, "DTSTAMP")).toEqual(["20261120T083000Z"]);
    expect(werte(nachher, "CREATED")).toEqual(werte(vorher, "CREATED"));
    expect(werte(nachher, "DTSTART")).toEqual(["20261123T140000Z"]);
    // removed, it leaves the feed
    await c.lea.anfrage(`/api/v1/dienstplan/schichten/${c.schichtId}`, { method: "DELETE" });
    expect(werte(await (await abrufen(c.server, url)).text(), "UID")).toEqual([]);
  });

  it("writes a night shift in the nights the clocks change with 7 and 9 hours", async () => {
    const c = await elbblick();
    for (const tag of ["2027-03-27", "2026-10-24"])
      await planen(c.lea, {
        ...schichtVon(c.standortId, c.tom.nutzerId, tag),
        beginnMinute: 22 * 60,
        endeMinute: 6 * 60,
      });
    await veroeffentlichen(c.lea, c.standortId, "2027-03-27");
    await veroeffentlichen(c.lea, c.standortId, "2026-10-24");
    const ics = await (await abrufen(c.server, (await ausstellen(c.tom)).url)).text();
    expect(werte(ics, "DTSTART")).toEqual(["20261024T200000Z", "20270327T210000Z"]);
    expect(werte(ics, "DTEND")).toEqual(["20261025T050000Z", "20270328T040000Z"]);
  });

  it("writes its words in the language of the app that issued it", async () => {
    const c = await mitPlan();
    const ics = await (await abrufen(c.server, (await ausstellen(c.tom, "en")).url)).text();
    expect(werte(ics, "SUMMARY")).toEqual(["Shift · Service"]);
    expect(werte(ics, "DESCRIPTION")).toEqual(["Break: 30 min"]);
  });

  it("reaches six weeks back, not further", async () => {
    const c = await mitPlan();
    const { url } = await ausstellen(c.tom);
    c.server.stelleUhr(Date.parse("2027-01-04T12:00:00Z"));
    expect(werte(await (await abrufen(c.server, url)).text(), "UID")).toEqual([c.schichtId]);
    c.server.stelleUhr(Date.parse("2027-01-05T12:00:00Z"));
    expect(werte(await (await abrufen(c.server, url)).text(), "UID")).toEqual([]);
  });
});

describe("the token of the feed", () => {
  it("is kept only as its SHA-256, in the audit chain", async () => {
    const c = await mitPlan();
    const { url } = await ausstellen(c.tom);
    const token = url.split("/ics/")[1]?.replace(/\.ics$/, "") ?? "";
    const zeilen = c.server.sqlite.query("SELECT token_hash FROM kalender_abos").all();
    expect(zeilen).toEqual([{ token_hash: sha256(token) }]);
    const roh = c.server.sqlite
      .query("SELECT count(*) AS n FROM audit_inhalte WHERE inhalt LIKE ?")
      .get(`%${token}%`);
    expect(roh).toEqual({ n: 0 });
    expect(kettePruefen(c.server.db, c.mia.betriebId)).toEqual([]);
  });

  it("stops at once when issued again, and when revoked", async () => {
    const c = await mitPlan();
    const alt = await ausstellen(c.tom);
    const neu = await ausstellen(c.tom);
    expect(neu.url).not.toBe(alt.url);
    expect((await abrufen(c.server, alt.url)).status).toBe(404);
    expect((await abrufen(c.server, neu.url)).status).toBe(200);
    expect((await c.tom.anfrage(KALENDER, { method: "DELETE" })).status).toBe(204);
    expect((await abrufen(c.server, neu.url)).status).toBe(404);
    expect(await json(await c.tom.anfrage(KALENDER))).toEqual({ abo: null });
    expect((await c.tom.anfrage(KALENDER, { method: "DELETE" })).status).toBe(404);
  });

  it("refuses a token nobody holds, one without .ics and one of another kind", async () => {
    const c = await mitPlan();
    const { url } = await ausstellen(c.tom);
    for (const falsch of [
      `${TEST_URL}/api/v1/ics/soll_ics_${"A".repeat(43)}.ics`,
      url.replace(/\.ics$/, ""),
      url.replace("soll_ics_", "soll_"),
    ])
      expect((await abrufen(c.server, falsch)).status, falsch).toBe(404);
  });

  it("is refused while the module Dienstplan is off, and for someone no longer a member", async () => {
    const c = await mitPlan();
    const { url } = await ausstellen(c.tom);
    await c.mia.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: false } });
    const aus = await abrufen(c.server, url);
    expect(aus.status).toBe(403);
    expect(await json(aus)).toEqual({ fehler: "modul_aus", modul: "dienstplan" });
    await c.mia.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });
    expect((await abrufen(c.server, url)).status).toBe(200);
    const weg = await c.mia.anfrage("/api/auth/organization/remove-member", {
      body: {
        memberIdOrEmail: await mitgliedId(c.mia, c.tom.nutzerId),
        organizationId: c.mia.betriebId,
      },
    });
    expect(weg.status).toBe(200);
    expect((await abrufen(c.server, url)).status).toBe(404);
  });

  it("is issued and revoked only with a session, never with an API token", async () => {
    const c = await mitPlan();
    const { token } = await tokenVon(c.tom);
    const api = mitToken(c.server, token);
    expect((await api(KALENDER)).status).toBe(200);
    for (const init of [{ body: { sprache: "de" } }, { method: "DELETE" }]) {
      const antwort = await api(KALENDER, init);
      expect(antwort.status).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "nur_sitzung" });
    }
  });

  it("never stands in the log", async () => {
    const zeilen: string[] = [];
    const c = await mitPlan(testServer({ log: (zeile) => zeilen.push(zeile) }));
    const { url } = await ausstellen(c.tom);
    await abrufen(c.server, url);
    const token = url.split("/ics/")[1] ?? "";
    expect(zeilen.some((zeile) => zeile.includes('"/api/v1/ics/…"'))).toBe(true);
    expect(zeilen.join("\n")).not.toContain(token.slice(0, 20));
  });

  it("stands in the person's Auskunft with its date and language, never with its hash", async () => {
    const c = await mitPlan();
    const { url } = await ausstellen(c.tom, "uk");
    const token = url.split("/ics/")[1]?.replace(/\.ics$/, "") ?? "";
    const auskunft = await json(await c.tom.anfrage("/api/v1/auskunft"));
    expect(auskunft.kalender).toEqual({
      angelegtAm: new Date(c.server.jetzt()).toISOString(),
      sprache: "uk",
    });
    expect(JSON.stringify(auskunft)).not.toContain(sha256(token));
    const kopie = await json(await c.mia.anfrage(`/api/v1/auskunft?nutzerId=${c.tom.nutzerId}`));
    expect(kopie.kalender).toBeUndefined();
  });

  it("is refused in a language the app does not have", async () => {
    const c = await mitPlan();
    expect((await c.tom.anfrage(KALENDER, { body: { sprache: "fr" } })).status).toBe(400);
  });
});

describe("no business sees or changes another's feed", () => {
  it("GET, POST and DELETE reach only the caller's own feed in their business", async () => {
    const c = await mitPlan();
    const jonas = await c.server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await jonas.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });
    const { url } = await ausstellen(c.tom);
    expect(await json(await jonas.anfrage(KALENDER))).toEqual({ abo: null });
    expect((await jonas.anfrage(KALENDER, { method: "DELETE" })).status).toBe(404);
    expect(await json(await c.mia.anfrage(KALENDER))).toEqual({ abo: null });
    expect((await c.mia.anfrage(KALENDER, { method: "DELETE" })).status).toBe(404);
    expect((await abrufen(c.server, url)).status).toBe(200);
    // Jonas's own feed holds nothing of Café Elbblick
    const eigener = await ausstellen(jonas);
    const ics = await (await abrufen(c.server, eigener.url)).text();
    expect(werte(ics, "UID")).toEqual([]);
    expect(werte(ics, "X-WR-CALNAME")).toEqual(["Soll · Weber Haustechnik"]);
  });

  it("POST veroeffentlichen does not publish another's week", async () => {
    const c = await mitPlan();
    const jonas = await c.server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    await jonas.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });
    const fremd = await veroeffentlichen(jonas, c.standortId);
    expect(fremd.status).toBe(404);
    const woche = await json(
      await c.lea.anfrage(`/api/v1/dienstplan/woche?standortId=${c.standortId}&tag=2026-11-23`),
    );
    const entwurf = (woche.schichten as { schichtId: string; veroeffentlichtAm: unknown }[]).find(
      (s) => s.schichtId === c.entwurfId,
    );
    expect(entwurf?.veroeffentlichtAm).toBeNull();
  });
});
