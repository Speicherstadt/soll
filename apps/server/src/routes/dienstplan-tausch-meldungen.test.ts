import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";
import { type Browser, json } from "./dienstplan-testhilfen.ts";

type Inhalt = { titel: string; text: string };

import {
  angeboten,
  elbblickZumTausch,
  elbblickZumTauschMitBoten,
  schritt,
} from "./dienstplan-tausch-testhilfen.ts";

/* Who hears of a swap, and the calendars of both persons (S-504) */

describe("the messages of a swap", () => {
  it("tell each step through S-503's delivery with the tag of the shift, never whoever acts", async () => {
    const c = await elbblickZumTauschMitBoten();
    await c.abonnieren(c.tom, "tom");
    await c.abonnieren(c.yusuf, "yusuf", "en");
    await c.abonnieren(c.lea, "lea");
    await c.abonnieren(c.olena, "olena", "uk");
    const tag = `plan-${c.schichtId}`;
    const gesendet = () =>
      c.zugestellt.splice(0).map((z) => [z.endpoint.split("/").at(-1), z.inhalt]);

    const tausch = await angeboten(c.tom, c.schichtId, c.yusuf.nutzerId);
    expect(gesendet()).toEqual([
      [
        "yusuf",
        {
          titel: "Shift offered",
          text: "A shift is offered to you: Mon, 11/23, 14:00–22:00.",
          ziel: "/dienstplan?tag=2026-11-23",
          tag,
        },
      ],
    ]);

    await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    expect(gesendet()).toEqual([
      [
        "tom",
        expect.objectContaining({
          titel: "Schicht übernommen",
          text: "Deine Schicht am Mo., 23.11., 14:00–22:00 ist übernommen und wartet auf Freigabe.",
          tag,
        }),
      ],
      ["lea", expect.objectContaining({ titel: "Tausch zur Freigabe", tag })],
    ]);
    // Mia approves too, she has no device: a mail in German
    expect(c.smtp.empfangen.map((mail) => mail.betreff)).toEqual(["Tausch zur Freigabe"]);

    await schritt(c.lea, tausch.tauschId, "freigeben");
    expect(gesendet()).toEqual([
      ["tom", expect.objectContaining({ titel: "Tausch freigegeben", tag })],
      ["yusuf", expect.objectContaining({ titel: "Swap approved", tag })],
    ]);
  });

  it("tell everyone who can take an offer to all, the taker of a withdrawal", async () => {
    const c = await elbblickZumTauschMitBoten();
    for (const [wer, name] of [
      [c.tom, "tom"],
      [c.yusuf, "yusuf"],
      [c.olena, "olena"],
      [c.lea, "lea"],
    ] as const)
      await c.abonnieren(wer, name);
    const empfaenger = () =>
      c.zugestellt
        .splice(0)
        .map((z) => z.endpoint.split("/").at(-1))
        .sort();
    const tausch = await angeboten(c.tom, c.schichtId);
    expect(empfaenger()).toEqual(["lea", "olena", "yusuf"]);
    expect(c.smtp.empfangen.map((mail) => mail.betreff)).toEqual(["Schicht zum Tausch"]);
    await schritt(c.olena, tausch.tauschId, "uebernehmen");
    empfaenger();
    await c.tom.anfrage(`/api/v1/dienstplan/tausch/${tausch.tauschId}`, { method: "DELETE" });
    expect(
      c.zugestellt.map((z) => [z.endpoint.split("/").at(-1), (z.inhalt as Inhalt).titel]),
    ).toEqual([["olena", "Angebot zurückgezogen"]]);
  });

  it("tell both parties of a refusal, without its reason", async () => {
    const c = await elbblickZumTauschMitBoten();
    await c.abonnieren(c.tom, "tom");
    await c.abonnieren(c.yusuf, "yusuf");
    const tausch = await angeboten(c.tom, c.schichtId, c.yusuf.nutzerId);
    await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    c.zugestellt.splice(0);
    await schritt(c.lea, tausch.tauschId, "ablehnen", { grund: "Inventur" });
    const inhalte = c.zugestellt.map((z) => z.inhalt as Inhalt);
    expect(inhalte.map((i) => i.titel)).toEqual(["Tausch abgelehnt", "Tausch abgelehnt"]);
    expect(inhalte.every((i) => !i.text.includes("Inventur"))).toBe(true);
  });
});

/** The values of a property in a feed */
const werte = (ics: string, name: string) =>
  ics
    .replaceAll("\r\n ", "")
    .split("\r\n")
    .filter((zeile) => zeile.startsWith(`${name}:`))
    .map((zeile) => zeile.slice(name.length + 1));

describe("the calendars of both persons", () => {
  it("follow the approval: the shift leaves one feed and enters the other", async () => {
    const server = testServer();
    const c = await elbblickZumTausch(server);
    const feed = async (wer: Browser) => {
      const { url } = (await json(
        await wer.anfrage("/api/v1/dienstplan/kalender", { body: { sprache: "de" } }),
      )) as { url: string };
      return async () => (await server.app.request(url, { headers: { cookie: "" } })).text();
    };
    const tomFeed = await feed(c.tom);
    const yusufFeed = await feed(c.yusuf);
    expect(werte(await tomFeed(), "UID")).toEqual([c.schichtId]);
    const sequenz = werte(await tomFeed(), "SEQUENCE");
    expect(werte(await yusufFeed(), "UID")).toEqual([]);

    const tausch = await angeboten(c.tom, c.schichtId);
    await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    // taken, not yet approved: the shift stays where it was
    expect(werte(await tomFeed(), "UID")).toEqual([c.schichtId]);
    server.stelleUhr(Date.parse("2026-11-20T08:30:00Z"));
    await schritt(c.lea, tausch.tauschId, "freigeben");
    expect(werte(await tomFeed(), "UID")).toEqual([]);
    const yusuf = await yusufFeed();
    expect(werte(yusuf, "UID")).toEqual([c.schichtId]);
    expect(Number(werte(yusuf, "SEQUENCE")[0])).toBe(Number(sequenz[0]) + 1);
    expect(werte(yusuf, "LAST-MODIFIED")).toEqual(["20261120T083000Z"]);
  });
});

describe("the swap in the Auskunft (Art. 15 DSGVO)", () => {
  it("holds the person's part of a swap, without the other person", async () => {
    const c = await elbblickZumTausch();
    const tausch = await angeboten(c.tom, c.schichtId, c.yusuf.nutzerId);
    await schritt(c.yusuf, tausch.tauschId, "uebernehmen");
    await schritt(c.lea, tausch.tauschId, "ablehnen", { grund: "Inventur" });
    const auskunft = await json(await c.yusuf.anfrage("/api/v1/auskunft"));
    expect(auskunft.schichttausche).toEqual([
      expect.objectContaining({
        tauschId: tausch.tauschId,
        deineRolle: ["angeboten", "uebernehmer"],
        status: "abgelehnt",
        grund: "Inventur",
      }),
    ]);
    expect(JSON.stringify(auskunft.schichttausche)).not.toContain(c.tom.nutzerId);
    expect(JSON.stringify(auskunft.schichttausche)).not.toContain(c.lea.nutzerId);
    const olena = await json(await c.olena.anfrage("/api/v1/auskunft"));
    expect(olena.schichttausche).toEqual([]);
  });
});
