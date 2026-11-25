import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { TEST_URL } from "../test-server.ts";
import {
  elbblick,
  elbblickMitBoten,
  json,
  planen,
  schichtVon,
  veroeffentlichen,
} from "./dienstplan-testhilfen.ts";

/* Publishing a week of the plan and the messages it sends (S-503) */

const wocheVon = async (
  wer: { anfrage: (pfad: string) => Promise<Response> },
  standortId: string,
  tag = "2026-11-23",
) => json(await wer.anfrage(`/api/v1/dienstplan/woche?standortId=${standortId}&tag=${tag}`));

const schichtenVon = async (...args: Parameters<typeof wocheVon>) =>
  (await wocheVon(...args)).schichten as { schichtId: string; veroeffentlichtAm: number | null }[];

describe("POST /api/v1/dienstplan/veroeffentlichen", () => {
  it("makes the drafts of the week visible to employees, in the audit chain", async () => {
    const { server, mia, lea, tom, standortId } = await elbblick();
    await planen(lea, schichtVon(standortId, tom.nutzerId));
    await planen(lea, schichtVon(standortId, null, "2026-11-29"));
    expect(await schichtenVon(tom, standortId)).toEqual([]);
    const antwort = await veroeffentlichen(lea, standortId);
    expect(antwort.status).toBe(200);
    expect(await json(antwort)).toEqual({ anzahl: 2, benachrichtigt: 0 });
    const gesehen = await schichtenVon(tom, standortId);
    expect(gesehen).toHaveLength(2);
    expect(gesehen.every((s) => s.veroeffentlichtAm === server.jetzt())).toBe(true);
    expect(kettePruefen(server.db, mia.betriebId)).toEqual([]);
  });

  it("leaves drafts of other weeks and other sites drafts, and publishes nothing twice", async () => {
    const { mia, lea, tom, standortId } = await elbblick();
    const anderer = await json(
      await mia.anfrage("/api/v1/standorte", { body: { name: "Hafen", land: "HH" } }),
    );
    await planen(lea, schichtVon(standortId, tom.nutzerId, "2026-11-30"));
    await planen(lea, schichtVon(standortId, tom.nutzerId, "2026-11-22"));
    await planen(lea, schichtVon(anderer.standortId as string, tom.nutzerId));
    expect(await json(await veroeffentlichen(lea, standortId))).toEqual({
      anzahl: 0,
      benachrichtigt: 0,
    });
    for (const tag of ["2026-11-30", "2026-11-16"])
      expect(await schichtenVon(tom, standortId, tag)).toEqual([]);
    expect(await schichtenVon(tom, anderer.standortId as string)).toEqual([]);
  });

  it("is for owner and planner only, and refuses a site of nobody", async () => {
    const { mia, lea, tom, standortId } = await elbblick();
    expect((await veroeffentlichen(tom, standortId)).status).toBe(403);
    expect((await veroeffentlichen(mia, standortId)).status).toBe(200);
    expect((await veroeffentlichen(lea, standortId)).status).toBe(200);
    const fremd = await veroeffentlichen(lea, "anderswo");
    expect(fremd.status).toBe(404);
    expect(await json(fremd)).toEqual({ fehler: "standort_unbekannt" });
    for (const body of [{}, { standortId }, { standortId, tag: "23.11.2026" }])
      expect((await lea.anfrage("/api/v1/dienstplan/veroeffentlichen", { body })).status).toBe(400);
  });

  it("is the notice of § 12 TzBfG: the instant of publishing is kept at the shift", async () => {
    const { server, lea, tom, standortId } = await elbblick();
    await planen(lea, schichtVon(standortId, tom.nutzerId));
    server.stelleUhr(Date.parse("2026-11-18T09:00:00Z"));
    await veroeffentlichen(lea, standortId);
    const [schicht] = await schichtenVon(tom, standortId);
    expect(schicht?.veroeffentlichtAm).toBe(Date.parse("2026-11-18T09:00:00Z"));
  });
});

describe("the messages of a published week", () => {
  it("tell Tom by Web Push in his device's language, Mia by mail, Lea who published nobody", async () => {
    const c = await elbblickMitBoten();
    await c.abonnieren(c.tom, "tom", "en");
    await c.abonnieren(c.lea, "lea");
    await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId));
    await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId, "2026-11-24"));
    await planen(c.lea, schichtVon(c.standortId, c.mia.nutzerId, "2026-11-25"));
    await planen(c.lea, schichtVon(c.standortId, c.lea.nutzerId, "2026-11-26"));
    expect(await json(await veroeffentlichen(c.lea, c.standortId))).toEqual({
      anzahl: 4,
      benachrichtigt: 2,
    });
    expect(c.zugestellt.map((z) => [z.endpoint, z.inhalt])).toEqual([
      [
        "https://fcm.googleapis.com/fcm/send/tom",
        {
          titel: "Rota published",
          text: "Your shifts for week 48 are in the plan.",
          ziel: "/dienstplan?tag=2026-11-23",
          tag: "plan-veroeffentlicht",
        },
      ],
    ]);
    expect(c.smtp.empfangen).toHaveLength(1);
    expect(c.smtp.empfangen[0]?.an).toEqual(["elbblick@betrieb.test"]);
    expect(c.smtp.empfangen[0]?.betreff).toBe("Dienstplan veröffentlicht");
    expect(c.smtp.empfangen[0]?.text).toContain("Deine Schichten für KW 48 stehen im Plan.");
    expect(c.smtp.empfangen[0]?.text).toContain(`${TEST_URL}/dienstplan?tag=2026-11-23`);
  });

  it("tell nobody about a change to a draft", async () => {
    const c = await elbblickMitBoten();
    await c.abonnieren(c.tom, "tom");
    const schicht = await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId));
    await c.lea.anfrage(`/api/v1/dienstplan/schichten/${schicht.schichtId}`, {
      method: "PATCH",
      body: { beginnMinute: 15 * 60 },
    });
    await c.lea.anfrage(`/api/v1/dienstplan/schichten/${schicht.schichtId}`, {
      method: "DELETE",
    });
    expect(c.zugestellt).toEqual([]);
    expect(c.smtp.empfangen).toEqual([]);
  });
});

describe("a change after publishing", () => {
  const veroeffentlicht = async () => {
    const c = await elbblickMitBoten();
    await c.abonnieren(c.tom, "tom");
    const schicht = await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId));
    await veroeffentlichen(c.lea, c.standortId);
    c.zugestellt.length = 0;
    const pfad = `/api/v1/dienstplan/schichten/${schicht.schichtId}`;
    return { ...c, pfad };
  };

  it("stays visible, is a new notice and tells the person again", async () => {
    const c = await veroeffentlicht();
    c.server.stelleUhr(c.server.jetzt() + 3_600_000);
    const geaendert = await json(
      await c.lea.anfrage(c.pfad, { method: "PATCH", body: { endeMinute: 23 * 60 } }),
    );
    expect(geaendert.veroeffentlichtAm).toBe(c.server.jetzt());
    expect((await schichtenVon(c.tom, c.standortId))[0]?.veroeffentlichtAm).toBe(c.server.jetzt());
    expect(c.zugestellt.map((z) => z.inhalt)).toEqual([
      {
        titel: "Schicht geändert",
        text: "Deine Schicht ist jetzt am Mo., 23.11., 14:00–23:00.",
        ziel: "/dienstplan?tag=2026-11-23",
        tag: "plan-geaendert",
      },
    ]);
    expect(kettePruefen(c.server.db, c.mia.betriebId)).toEqual([]);
  });

  it("tells the person before and the person after when it moves to someone else", async () => {
    const c = await veroeffentlicht();
    await c.abonnieren(c.lea, "lea");
    // Mia moves it to Lea: both are told, the one who moved it is not
    await c.mia.anfrage(c.pfad, { method: "PATCH", body: { nutzerId: c.lea.nutzerId } });
    expect(c.zugestellt.map((z) => [z.endpoint, (z.inhalt as { titel: string }).titel])).toEqual([
      ["https://fcm.googleapis.com/fcm/send/tom", "Schicht entfällt"],
      ["https://fcm.googleapis.com/fcm/send/lea", "Neue Schicht"],
    ]);
  });

  it("tells the person when it is removed, and nobody when nothing changed", async () => {
    const c = await veroeffentlicht();
    const vorher = c.server.sqlite.query("SELECT count(*) AS n FROM audit_glieder").get();
    await c.lea.anfrage(c.pfad, { method: "PATCH", body: { tag: "2026-11-23" } });
    expect(c.zugestellt).toEqual([]);
    // a change that changes nothing writes nothing
    expect(c.server.sqlite.query("SELECT count(*) AS n FROM audit_glieder").get()).toEqual(vorher);
    expect((await c.lea.anfrage(c.pfad, { method: "DELETE" })).status).toBe(204);
    expect(c.zugestellt.map((z) => z.inhalt)).toEqual([
      {
        titel: "Schicht entfällt",
        text: "Deine Schicht am Mo., 23.11., 14:00–22:00 entfällt.",
        ziel: "/dienstplan?tag=2026-11-23",
        tag: "plan-entfaellt",
      },
    ]);
  });
});
