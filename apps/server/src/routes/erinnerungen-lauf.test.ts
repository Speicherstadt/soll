import { describe, expect, it } from "vitest";
import { TEST_URL } from "../test-server.ts";
import { cafe, PFAD, TAG, um } from "./erinnerungen-testhilfen.ts";

const stempelZeilen = (server: Awaited<ReturnType<typeof cafe>>["server"]) =>
  server.sqlite.query("SELECT * FROM stempelungen ORDER BY rowid").all();

describe("Ausstempeln vergessen", () => {
  it("reaches Tom's device by Web Push once, ten hours after Kommen, and never stamps", async () => {
    const c = await cafe();
    await c.abonnieren(c.tom, "tom");
    await c.stempeln(c.tom, "kommen", um(TAG, "07:00"));
    const vorher = stempelZeilen(c.server);
    expect(await c.lauf(um(TAG, "16:59"))).toEqual([]);
    expect(await c.lauf(um(TAG, "17:00"))).toEqual([
      { betriebId: c.mia.betriebId, nutzerId: c.tom.nutzerId, art: "ausstempeln", kanal: "push" },
    ]);
    expect(await c.lauf(um(TAG, "17:05"))).toEqual([]);
    expect(c.dienst.zugestellt).toEqual([
      {
        endpoint: "https://push.example.test/tom",
        ttl: 43_200,
        inhalt: {
          titel: "Ausstempeln vergessen?",
          text: "Du bist seit 07:00 Uhr eingestempelt. Soll stempelt nie selbst aus: Trag dein Gehen ein, wenn du schon weg bist.",
          ziel: "/",
          tag: "ausstempeln",
        },
      },
    ]);
    expect(stempelZeilen(c.server)).toEqual(vorher);
    const tag = (await (await c.tom.anfrage("/api/v1/arbeitszeit/tag")).json()) as {
      stand: { zustand: string };
    };
    expect(tag.stand.zustand).toBe("arbeit");
  });

  it("reaches Mia by mail over SMTP when she has no device", async () => {
    const c = await cafe();
    await c.stempeln(c.mia, "kommen", um(TAG, "07:00"));
    expect((await c.lauf(um(TAG, "17:00"))).map((g) => g.kanal)).toEqual(["mail"]);
    expect(c.smtp.empfangen).toHaveLength(1);
    expect(c.smtp.empfangen[0]?.an).toEqual(["elbblick@betrieb.test"]);
    expect(c.smtp.empfangen[0]?.betreff).toBe("Ausstempeln vergessen?");
    expect(c.smtp.empfangen[0]?.text).toContain("seit 07:00 Uhr");
    expect(c.smtp.empfangen[0]?.text).toContain(`${TEST_URL}/`);
  });
});

describe("Pause fällig", () => {
  it("reaches Tom 15 minutes before six hours, in the language of his device", async () => {
    const c = await cafe();
    await c.abonnieren(c.tom, "tom", "tr");
    await c.stempeln(c.tom, "kommen", um(TAG, "08:00"));
    expect(await c.lauf(um(TAG, "13:44"))).toEqual([]);
    expect((await c.lauf(um(TAG, "13:45"))).map((g) => g.art)).toEqual(["pause"]);
    expect(c.dienst.zugestellt.map((z) => z.inhalt)).toEqual([
      {
        titel: "Mola zamanı",
        text: "Saat 14:00 itibarıyla 30 dakika mola vermelisin (§ 4 ArbZG).",
        ziel: "/",
        tag: "pause",
      },
    ]);
  });

  it("comes again for the next step after a break, by mail for Mia", async () => {
    const c = await cafe();
    await c.stempeln(c.mia, "kommen", um(TAG, "08:00"));
    await c.lauf(um(TAG, "13:45"));
    await c.stempeln(c.mia, "pause_beginn", um(TAG, "13:50"));
    await c.stempeln(c.mia, "pause_ende", um(TAG, "14:20"));
    // 5:50 h before the break and 3:10 h after it: nine hours of work at 17:30, 45 minutes owed
    expect(await c.lauf(um(TAG, "17:14"))).toEqual([]);
    expect((await c.lauf(um(TAG, "17:15"))).map((g) => g.art)).toEqual(["pause"]);
    expect(c.smtp.empfangen.at(-1)?.text).toContain("17:30 Uhr brauchst du 15 Minuten Pause");
    expect((await c.lauf(um(TAG, "18:00"))).map((g) => g.art)).toEqual(["ausstempeln"]);
    expect(c.smtp.empfangen.map((m) => m.betreff)).toEqual([
      "Pause fällig",
      "Pause fällig",
      "Ausstempeln vergessen?",
    ]);
  });
});

describe("Monat bestätigen", () => {
  const oktober = async () => {
    const c = await cafe();
    await c.abonnieren(c.tom, "tom", "en");
    for (const wer of [c.tom, c.mia]) {
      await c.stempeln(wer, "kommen", Date.parse("2026-10-14T08:00:00+02:00"));
      await c.stempeln(wer, "gehen", Date.parse("2026-10-14T12:00:00+02:00"));
    }
    return c;
  };

  it("reaches both at 9:00 on the 1st of the next month, by push and by mail", async () => {
    const c = await oktober();
    expect(await c.lauf(um("2026-11-01", "08:59"))).toEqual([]);
    const gesendet = await c.lauf(um("2026-11-01", "09:00"));
    expect(gesendet.map((g) => [g.art, g.kanal]).sort()).toEqual([
      ["monat", "mail"],
      ["monat", "push"],
    ]);
    expect(c.dienst.zugestellt.map((z) => z.inhalt)).toEqual([
      {
        titel: "Confirm your month",
        text: "Please check and confirm your times for October 2026.",
        ziel: "/monat",
        tag: "monat",
      },
    ]);
    expect(c.smtp.empfangen[0]?.betreff).toBe("Monat bestätigen");
    expect(c.smtp.empfangen[0]?.text).toContain("Oktober 2026");
    expect(c.smtp.empfangen[0]?.text).toContain(`${TEST_URL}/monat`);
    expect(await c.lauf(um("2026-11-02", "09:00"))).toEqual([]);
  });

  it("is not sent to whoever confirmed the month, and comes on the business's day", async () => {
    const c = await oktober();
    c.server.stelleUhr(um("2026-11-01", "07:00"));
    await c.tom.anfrage(`${PFAD}/regeln`, { method: "PUT", body: {} });
    expect(
      (
        await c.mia.anfrage(`${PFAD}/regeln`, {
          method: "PUT",
          body: { gehenMinuten: 600, pauseVorlauf: 15, monatTag: 3 },
        })
      ).status,
    ).toBe(200);
    const bestaetigt = await c.tom.anfrage("/api/v1/arbeitszeit/monat/bestaetigen", {
      body: { monat: "2026-10" },
    });
    expect(bestaetigt.status).toBe(201);
    expect(await c.lauf(um("2026-11-02", "12:00"))).toEqual([]);
    expect(await c.lauf(um("2026-11-03", "09:00"))).toEqual([
      { betriebId: c.mia.betriebId, nutzerId: c.mia.nutzerId, art: "monat", kanal: "mail" },
    ]);
  });
});

describe("delivery", () => {
  it("removes a subscription the push service no longer knows (410) and falls back to mail", async () => {
    const c = await cafe();
    await c.abonnieren(c.mia, "mia");
    c.antworten.set("https://push.example.test/mia", 410);
    await c.stempeln(c.mia, "kommen", um(TAG, "07:00"));
    expect((await c.lauf(um(TAG, "17:00"))).map((g) => g.kanal)).toEqual(["mail"]);
    expect(c.server.sqlite.query("SELECT * FROM push_abos").all()).toEqual([]);
  });

  it("keeps a subscription after a passing error of the push service, and mails instead", async () => {
    const c = await cafe();
    await c.abonnieren(c.mia, "mia");
    c.antworten.set("https://push.example.test/mia", 503);
    await c.stempeln(c.mia, "kommen", um(TAG, "07:00"));
    expect((await c.lauf(um(TAG, "17:00"))).map((g) => g.kanal)).toEqual(["mail"]);
    expect(c.server.sqlite.query("SELECT * FROM push_abos").all()).toHaveLength(1);
  });

  it("asks nothing of someone who cannot be reached, so a device subscribed later still gets it", async () => {
    const c = await cafe();
    await c.stempeln(c.tom, "kommen", um(TAG, "07:00"));
    expect(await c.lauf(um(TAG, "17:00"))).toEqual([]);
    expect(c.server.sqlite.query("SELECT * FROM erinnerungen").all()).toEqual([]);
    await c.abonnieren(c.tom, "tom");
    expect((await c.lauf(um(TAG, "17:01"))).map((g) => g.kanal)).toEqual(["push"]);
  });

  it("sends nothing a person switched off, also no mail when mail is switched off", async () => {
    const c = await cafe();
    await c.abonnieren(c.tom, "tom");
    const aus = { ausstempeln: false, pause: true, monat: true, mail: false };
    expect((await c.tom.anfrage(`${PFAD}/wuensche`, { method: "PUT", body: aus })).status).toBe(
      200,
    );
    expect((await c.mia.anfrage(`${PFAD}/wuensche`, { method: "PUT", body: aus })).status).toBe(
      200,
    );
    for (const wer of [c.tom, c.mia]) await c.stempeln(wer, "kommen", um(TAG, "07:00"));
    expect(await c.lauf(um(TAG, "17:00"))).toEqual([]);
    expect(c.smtp.empfangen).toEqual([]);
  });

  it("sends nothing for a business that switched working time off", async () => {
    const c = await cafe();
    await c.abonnieren(c.mia, "mia");
    await c.stempeln(c.mia, "kommen", um(TAG, "07:00"));
    c.server.sqlite.run("UPDATE betriebe SET modul_arbeitszeit = 0");
    expect(await c.lauf(um(TAG, "17:00"))).toEqual([]);
  });
});
