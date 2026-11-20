import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { testServer } from "../test-server.ts";
import { testGeraet } from "./geraet-test-hilfen.ts";
import { abgeschlossen, um as am, JETZT } from "./monat-testhilfen.ts";

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;
// 20.11.2026, a Friday in winter time (+01:00)
const um = (zeit: string) => Date.parse(`2026-11-20T${zeit}+01:00`);

/** Café Elbblick with Tom, whose phone has a registered device key, at 09:00 */
const cafe = async () => {
  const server = testServer();
  server.stelleUhr(um("09:00"));
  const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  const tom = await server.eingeladen(mia, "mitarbeiter", "tom");
  const geraet = await testGeraet();
  const angemeldet = await tom.anfrage(`/api/v1/arbeitszeit/geraete/${geraet.geraetId}`, {
    method: "PUT",
    body: { schluessel: geraet.schluessel },
  });
  expect(angemeldet.status).toBe(201);
  const senden = async (body: unknown, wer: { anfrage: typeof tom.anfrage } = tom) =>
    wer.anfrage("/api/v1/arbeitszeit/stempelungen/offline", { body });
  return { server, mia, tom, geraet, senden };
};

const zeilen = (server: ReturnType<typeof testServer>) =>
  server.sqlite
    .query(
      "SELECT art, zeitpunkt, geraet_zeitpunkt, offline, nummer, geraet_id, erstellt_am FROM stempelungen ORDER BY nummer",
    )
    .all();

describe("registering a device (S-305)", () => {
  it("keeps the public key once: again with the same key changes nothing", async () => {
    const { server, tom, geraet } = await cafe();
    const nochmal = await tom.anfrage(`/api/v1/arbeitszeit/geraete/${geraet.geraetId}`, {
      method: "PUT",
      body: { schluessel: geraet.schluessel },
    });
    expect(nochmal.status).toBe(200);
    expect(server.sqlite.query("SELECT nutzer_id FROM geraete").all()).toEqual([
      { nutzer_id: tom.nutzerId },
    ]);
  });

  it("refuses another key or another person for a device id that is taken", async () => {
    const { server, mia, tom, geraet } = await cafe();
    const anderer = await testGeraet(geraet.geraetId);
    const andererSchluessel = await tom.anfrage(`/api/v1/arbeitszeit/geraete/${geraet.geraetId}`, {
      method: "PUT",
      body: { schluessel: anderer.schluessel },
    });
    expect(andererSchluessel.status).toBe(409);
    const anderePerson = await mia.anfrage(`/api/v1/arbeitszeit/geraete/${geraet.geraetId}`, {
      method: "PUT",
      body: { schluessel: geraet.schluessel },
    });
    expect(anderePerson.status).toBe(409);
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM geraete").get()).toEqual({ n: 1 });
  });

  it("refuses a key that is not a point of P-256 and a device id that is no UUID", async () => {
    const { tom, geraet } = await cafe();
    const kaputt = { ...geraet.schluessel, x: "A".repeat(43) };
    const neu = crypto.randomUUID();
    const falsch = await tom.anfrage(`/api/v1/arbeitszeit/geraete/${neu}`, {
      method: "PUT",
      body: { schluessel: kaputt },
    });
    expect(falsch.status).toBe(400);
    const keineId = await tom.anfrage("/api/v1/arbeitszeit/geraete/handy", {
      method: "PUT",
      body: { schluessel: geraet.schluessel },
    });
    expect(keineId.status).toBe(400);
  });
});

describe("an entry of the offline queue (S-305)", () => {
  it("stores the device's time and the receipt, marked offline, and Heute shows it", async () => {
    const { server, mia, tom, geraet, senden } = await cafe();
    const antwort = await senden(await geraet.offline(1, "kommen", um("07:58"), um("09:00")));
    expect(antwort.status).toBe(201);
    expect(await json(antwort)).toMatchObject({
      art: "kommen",
      zeitpunkt: um("07:58"),
      geraetZeitpunkt: um("07:58"),
      offline: true,
      nummer: 1,
      korrigiert: false,
    });
    expect(zeilen(server)).toEqual([
      {
        art: "kommen",
        zeitpunkt: um("07:58"),
        geraet_zeitpunkt: um("07:58"),
        offline: 1,
        nummer: 1,
        geraet_id: geraet.geraetId,
        erstellt_am: um("09:00"),
      },
    ]);
    const tag = await json(await tom.anfrage("/api/v1/arbeitszeit/tag"));
    expect(tag.stempelungen).toMatchObject([{ art: "kommen", offline: true }]);
    expect(tag.stand).toMatchObject({ zustand: "arbeit", seit: um("07:58") });
    expect(tag.luecken).toEqual([]);
    // the device and the stamp stand in the audit chain
    expect(kettePruefen(server.db, mia.betriebId)).toEqual([]);
  });

  it("moves the device's time by the error of its clock at sending", async () => {
    const { server, geraet, senden } = await cafe();
    // the phone runs 10 minutes fast
    await senden(await geraet.offline(1, "kommen", um("08:08"), um("09:10")));
    expect(zeilen(server)).toMatchObject([
      { zeitpunkt: um("07:58"), geraet_zeitpunkt: um("08:08") },
    ]);
  });

  it("makes one stamp of the same entry sent twice", async () => {
    const { server, geraet, senden } = await cafe();
    const eintrag = await geraet.offline(1, "kommen", um("07:58"), um("09:00"));
    expect((await senden(eintrag)).status).toBe(201);
    server.stelleUhr(um("09:01"));
    // sent again a minute later, with a new sending time: the answer was lost on the way
    const nochmal = await senden({ ...eintrag, gesendetAm: um("09:01") });
    expect(nochmal.status).toBe(200);
    expect(await json(nochmal)).toMatchObject({ zeitpunkt: um("07:58"), nummer: 1 });
    expect(zeilen(server)).toHaveLength(1);
  });

  it("refuses another entry under a number already taken", async () => {
    const { server, geraet, senden } = await cafe();
    await senden(await geraet.offline(1, "kommen", um("07:58"), um("09:00")));
    const anders = await senden(await geraet.offline(1, "gehen", um("08:30"), um("09:00")));
    expect(anders.status).toBe(409);
    expect(await json(anders)).toEqual({ fehler: "doppelt" });
    expect(zeilen(server)).toHaveLength(1);
  });

  it("refuses a signature that does not fit the entry or the device", async () => {
    const { server, geraet, senden } = await cafe();
    const eintrag = await geraet.offline(1, "kommen", um("07:58"), um("09:00"));
    // the time changed after signing
    const verschoben = await senden({ ...eintrag, geraetZeitpunkt: um("07:00") });
    expect(verschoben.status).toBe(422);
    expect(await json(verschoben)).toEqual({ fehler: "signatur" });
    const fremd = await testGeraet(geraet.geraetId);
    const falscherSchluessel = await senden(
      await fremd.offline(1, "kommen", um("07:58"), um("09:00")),
    );
    expect(falscherSchluessel.status).toBe(422);
    const kaputt = await senden({
      ...eintrag,
      geraet: { ...eintrag.geraet, signatur: "A".repeat(86) },
    });
    expect(kaputt.status).toBe(422);
    expect(zeilen(server)).toEqual([]);
  });

  it("does not take an entry of an unknown device or of another person's device", async () => {
    const { server, mia, geraet, senden } = await cafe();
    const unbekannt = await testGeraet();
    const ohneAnmeldung = await senden(
      await unbekannt.offline(1, "kommen", um("07:58"), um("09:00")),
    );
    expect(ohneAnmeldung.status).toBe(404);
    const vonMia = await senden(await geraet.offline(1, "kommen", um("07:58"), um("09:00")), mia);
    expect(vonMia.status).toBe(404);
    expect(await json(vonMia)).toEqual({ fehler: "geraet_unbekannt" });
    expect(zeilen(server)).toEqual([]);
  });

  it("refuses an entry stamped after it was sent", async () => {
    const { server, geraet, senden } = await cafe();
    const spaeter = await senden(await geraet.offline(1, "kommen", um("09:05"), um("09:00")));
    expect(spaeter.status).toBe(422);
    expect(await json(spaeter)).toEqual({ fehler: "zukunft" });
    expect(zeilen(server)).toEqual([]);
  });

  it("refuses an entry that is no stamp of the device: number 0, a fraction, unknown fields", async () => {
    const { geraet, senden } = await cafe();
    const eintrag = await geraet.offline(1, "kommen", um("07:58"), um("09:00"));
    for (const falsch of [
      { ...eintrag, geraet: { ...eintrag.geraet, nummer: 0 } },
      { ...eintrag, geraet: { ...eintrag.geraet, nummer: 1.5 } },
      { ...eintrag, geraetZeitpunkt: um("07:58") + 0.5 },
      { ...eintrag, nutzerId: "jemand" },
      { ...eintrag, zeitpunkt: um("07:58") },
      { art: eintrag.art, geraetZeitpunkt: eintrag.geraetZeitpunkt, geraet: eintrag.geraet },
    ]) {
      expect((await senden(falsch)).status, JSON.stringify(falsch)).toBe(400);
    }
  });
});

describe("gaps in the numbers of a device (S-305)", () => {
  it("shows a missing number to the person and to the owner, and closes it when it arrives", async () => {
    const { mia, tom, geraet, senden } = await cafe();
    const eins = await geraet.offline(1, "kommen", um("07:58"), um("09:00"));
    const zwei = await geraet.offline(2, "pause_beginn", um("08:20"), um("09:00"));
    const drei = await geraet.offline(3, "pause_ende", um("08:40"), um("09:00"));
    await senden(eins);
    // number 2 is lost on the way; 3 arrives: the gap shows
    expect((await senden(drei)).status).toBe(201);
    const luecke = [{ geraetId: geraet.geraetId, von: 2, bis: 2 }];
    expect((await json(await tom.anfrage("/api/v1/arbeitszeit/tag"))).luecken).toEqual(luecke);
    const fuerMia = await json(
      await mia.anfrage(`/api/v1/arbeitszeit/tag?nutzerId=${tom.nutzerId}`),
    );
    expect(fuerMia.luecken).toEqual(luecke);
    // the late entry with the smaller number is taken and closes the gap
    expect((await senden(zwei)).status).toBe(201);
    expect((await json(await tom.anfrage("/api/v1/arbeitszeit/tag"))).luecken).toEqual([]);
  });

  it("keeps a gap of the person's devices out of another person's day", async () => {
    const { mia, geraet, senden } = await cafe();
    await senden(await geraet.offline(2, "kommen", um("07:58"), um("09:00")));
    expect((await json(await mia.anfrage("/api/v1/arbeitszeit/tag"))).luecken).toEqual([]);
  });

  it("still counts a number whose stamp was removed with a reason", async () => {
    const { tom, geraet, senden } = await cafe();
    const eins = await json(
      await senden(await geraet.offline(1, "kommen", um("07:58"), um("09:00"))),
    );
    await senden(await geraet.offline(2, "gehen", um("08:58"), um("09:00")));
    const entfernt = await tom.anfrage(
      `/api/v1/arbeitszeit/stempelungen/${eins.stempelId}/entfernen`,
      {
        body: { grund: "doppelt getippt" },
      },
    );
    expect(entfernt.status).toBe(201);
    expect((await json(await tom.anfrage("/api/v1/arbeitszeit/tag"))).luecken).toEqual([]);
  });
});

describe("a live stamp signed by the device (S-305)", () => {
  const live = async (
    geraet: Awaited<ReturnType<typeof testGeraet>>,
    nummer: number,
    geraetZeitpunkt: number,
  ) => ({
    art: "kommen" as const,
    geraetZeitpunkt,
    geraet: {
      geraetId: geraet.geraetId,
      nummer,
      signatur: await geraet.signieren({
        geraetId: geraet.geraetId,
        nummer,
        art: "kommen",
        geraetZeitpunkt,
      }),
    },
  });

  it("counts the server's clock, keeps the number, and makes nothing new when the queue sends it again", async () => {
    const { server, tom, geraet, senden } = await cafe();
    const body = await live(geraet, 1, um("08:55"));
    const antwort = await tom.anfrage("/api/v1/arbeitszeit/stempelungen", { body });
    expect(antwort.status).toBe(201);
    expect(await json(antwort)).toMatchObject({
      zeitpunkt: um("09:00"),
      nummer: 1,
      offline: false,
    });
    // the answer was lost: the queue sends the same entry later
    server.stelleUhr(um("09:30"));
    const nochmal = await senden({ ...body, gesendetAm: um("09:29") });
    expect(nochmal.status).toBe(200);
    expect(await json(nochmal)).toMatchObject({ zeitpunkt: um("09:00"), offline: false });
    expect(zeilen(server)).toHaveLength(1);
  });

  it("refuses a live stamp with a wrong signature or without the device's time it signed", async () => {
    const { server, tom, geraet } = await cafe();
    const body = await live(geraet, 1, um("08:55"));
    const falsch = await tom.anfrage("/api/v1/arbeitszeit/stempelungen", {
      body: { ...body, geraetZeitpunkt: um("08:00") },
    });
    expect(falsch.status).toBe(422);
    const ohneZeit = await tom.anfrage("/api/v1/arbeitszeit/stempelungen", {
      body: { art: body.art, geraet: body.geraet },
    });
    expect(ohneZeit.status).toBe(400);
    expect(zeilen(server)).toEqual([]);
  });
});

describe("a correction of an offline stamp", () => {
  it("stays offline while it keeps the device's instant, and no longer when a person moves it", async () => {
    const { tom, geraet, senden } = await cafe();
    const eins = await json(
      await senden(await geraet.offline(1, "kommen", um("07:58"), um("09:00"))),
    );
    const art = await json(
      await tom.anfrage(`/api/v1/arbeitszeit/stempelungen/${eins.stempelId}`, {
        method: "PATCH",
        body: { art: "kommen", zeitpunkt: um("07:58"), grund: "nur geprüft" },
      }),
    );
    expect(art).toMatchObject({ offline: true, korrigiert: true, nummer: null });
    const verschoben = await json(
      await tom.anfrage(`/api/v1/arbeitszeit/stempelungen/${art.stempelId}`, {
        method: "PATCH",
        body: { art: "kommen", zeitpunkt: um("07:30"), grund: "früher gekommen" },
      }),
    );
    expect(verschoben).toMatchObject({ offline: false, korrigiert: true });
  });
});

describe("an offline stamp and a closed month (S-306)", () => {
  const TAG = 24 * 60 * 60 * 1000;

  it("is refused when its instant, corrected by the device's clock, lies in the closed month", async () => {
    const { server, sandra } = await abgeschlossen();
    const geraet = await testGeraet();
    await sandra.anfrage(`/api/v1/arbeitszeit/geraete/${geraet.geraetId}`, {
      method: "PUT",
      body: { schluessel: geraet.schluessel },
    });
    const senden = async (body: unknown) =>
      sandra.anfrage("/api/v1/arbeitszeit/stempelungen/offline", { body });
    const vorher = server.sqlite.query("SELECT COUNT(*) AS n FROM stempelungen").get();
    // stamped on 7 October, sent now with a clock that runs right
    const oktober = await senden(
      await geraet.offline(1, "kommen", am("2026-10-07T08:00:00+02:00"), JETZT),
    );
    expect(oktober.status).toBe(409);
    expect(await json(oktober)).toEqual({ fehler: "abgeschlossen" });
    // the device's clock runs three days ahead: it says 2 November, the server's clock 30 October
    const vorgehend = await senden(
      await geraet.offline(2, "kommen", am("2026-11-02T08:00:00+01:00"), JETZT + 3 * TAG),
    );
    expect(vorgehend.status).toBe(409);
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM stempelungen").get()).toEqual(vorher);
    // three days behind: it says 30 October, which is 2 November in the open month
    const nachgehend = await senden(
      await geraet.offline(3, "kommen", am("2026-10-30T08:00:00+01:00"), JETZT - 3 * TAG),
    );
    expect(nachgehend.status).toBe(201);
    expect(await json(nachgehend)).toMatchObject({ zeitpunkt: am("2026-11-02T08:00:00+01:00") });
  });
});
