import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { testServer } from "../test-server.ts";
import {
  abgeschlossen,
  abschliessen,
  bestaetigen,
  JETZT,
  type Json,
  json,
  pruefen,
  weber,
} from "./monat-testhilfen.ts";

const betriebMitPlan = async () => {
  const w = await weber();
  await w.jonas.anfrage("/api/v1/betrieb/module", {
    method: "PATCH",
    body: { dienstplan: true },
  });
  const standorte = await json(await w.jonas.anfrage("/api/v1/standorte"));
  const standortId = ((standorte.standorte as Json[])[0]?.standortId as string) ?? "";
  const schichtAnlegen = async (body: Json) =>
    json(
      await w.jonas.anfrage("/api/v1/dienstplan/schichten", {
        body: { standortId, rolle: "Service", pauseMinuten: 0, ...body },
      }),
    );
  const veroeffentlichen = (tag: string) =>
    w.jonas.anfrage("/api/v1/dienstplan/veroeffentlichen", { body: { standortId, tag } });
  const quelleSetzen = (ab: string, quelle: "modell" | "plan") =>
    w.jonas.anfrage("/api/v1/arbeitszeit/sollquellen", { method: "PUT", body: { ab, quelle } });
  return { ...w, standortId, schichtAnlegen, veroeffentlichen, quelleSetzen };
};

describe("Soll aus dem Plan: roles, modules and tenants (S-505)", () => {
  it("allows only the owner to change the source, rejects non-owners and invalid bodies", async () => {
    const { jonas, anna, sandra, lohn, quelleSetzen } = await betriebMitPlan();
    expect((await sandra.anfrage("/api/v1/arbeitszeit/sollquellen")).status).toBe(200);
    for (const wer of [anna, sandra, lohn]) {
      const antwort = await wer.anfrage("/api/v1/arbeitszeit/sollquellen", {
        method: "PUT",
        body: { ab: "2026-10-01", quelle: "plan" },
      });
      expect(antwort.status).toBe(403);
    }
    expect(
      (
        await jonas.anfrage("/api/v1/arbeitszeit/sollquellen", {
          method: "PUT",
          body: { ab: "2026-02-30", quelle: "plan" },
        })
      ).status,
    ).toBe(400);
    const gesetzt = await quelleSetzen("2026-10-01", "plan");
    expect(gesetzt.status).toBe(200);
    expect(await json(gesetzt)).toEqual({
      quellen: [{ ab: "2026-10-01", quelle: "plan" }],
      fruehestens: null,
    });
  });

  it("refuses 'plan' while the module Dienstplan is off, but still allows switching to 'modell'", async () => {
    const { jonas } = await weber();
    const plan = await jonas.anfrage("/api/v1/arbeitszeit/sollquellen", {
      method: "PUT",
      body: { ab: "2026-10-01", quelle: "plan" },
    });
    expect(plan.status).toBe(409);
    expect((await json(plan)).fehler).toBe("dienstplan_aus");
    const modell = await jonas.anfrage("/api/v1/arbeitszeit/sollquellen", {
      method: "PUT",
      body: { ab: "2026-10-01", quelle: "modell" },
    });
    expect(modell.status).toBe(200);
  });

  it("isolates Soll sources strictly per business (tenant isolation)", async () => {
    const server = testServer();
    server.stelleUhr(JETZT);
    const a = await server.inhaberMitBetrieb("Betrieb A", "inhaber-a");
    const b = await server.inhaberMitBetrieb("Betrieb B", "inhaber-b");
    await a.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });
    await b.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });
    expect(
      (
        await a.anfrage("/api/v1/arbeitszeit/sollquellen", {
          method: "PUT",
          body: { ab: "2026-10-01", quelle: "plan" },
        })
      ).status,
    ).toBe(200);
    expect(await json(await b.anfrage("/api/v1/arbeitszeit/sollquellen"))).toEqual({
      quellen: [],
      fruehestens: null,
    });
  });
});

describe("Soll aus dem Plan: month, day view, absences and DST", () => {
  it("counts only published shifts as Soll, works across DST, on Heute, and credits absences", async () => {
    const { server, sandra, jonas, schichtAnlegen, veroeffentlichen, quelleSetzen } =
      await betriebMitPlan();
    await quelleSetzen("2026-10-01", "plan");

    // 6 Oct: 8:00 published (with 30 min break); 14 Oct (next week): draft only (must not count)
    await schichtAnlegen({
      tag: "2026-10-06",
      beginnMinute: 8 * 60,
      endeMinute: 16 * 60 + 30,
      pauseMinuten: 30,
      nutzerId: sandra.nutzerId,
    });
    expect((await veroeffentlichen("2026-10-06")).status).toBe(200);
    await schichtAnlegen({
      tag: "2026-10-14",
      beginnMinute: 8 * 60,
      endeMinute: 14 * 60,
      nutzerId: sandra.nutzerId,
    });

    // 24 Oct: night shift 22:00 – 06:00 over Herbst DST -> 9h = 540 min
    await schichtAnlegen({
      tag: "2026-10-24",
      beginnMinute: 22 * 60,
      endeMinute: 6 * 60,
      nutzerId: sandra.nutzerId,
    });
    expect((await veroeffentlichen("2026-10-24")).status).toBe(200);

    // 10 Oct (Saturday, 0h in model): 6h published shift + sickness -> Ausfallprinzip credits 360 min
    await schichtAnlegen({
      tag: "2026-10-10",
      beginnMinute: 10 * 60,
      endeMinute: 16 * 60,
      nutzerId: sandra.nutzerId,
    });
    expect((await veroeffentlichen("2026-10-10")).status).toBe(200);
    // Sandra reports sick on 2026-10-10
    server.stelleUhr(Date.parse("2026-10-10T07:00:00+02:00"));
    expect(
      (
        await sandra.anfrage("/api/v1/arbeitszeit/abwesenheiten/krank", {
          body: { art: "krank", bis: "2026-10-10" },
        })
      ).status,
    ).toBe(201);
    server.stelleUhr(JETZT);

    const monat = await json(
      await jonas.anfrage(`/api/v1/arbeitszeit/monat?monat=2026-10&nutzerId=${sandra.nutzerId}`),
    );
    const inhalt = monat.inhalt as Json;
    const summen = inhalt.summen as Json;
    // Soll: 480 (6 Oct) + 360 (10 Oct) + 540 (24 Oct DST) = 1380 min
    expect(summen.sollMinuten).toBe(1380);
    // Worked: 480 (6 Oct) + 360 (31 Oct) = 840; credited sickness: 360 (10 Oct) -> Ist = 1200
    expect(summen.gutschriftMinuten).toBe(360);
    expect(summen.istMinuten).toBe(1200);
    expect(summen.saldoMinuten).toBe(-180);

    const tage = inhalt.tage as Json[];
    expect(tage.find((t) => t.tag === "2026-10-06")?.planMinuten).toBe(480);
    expect(tage.find((t) => t.tag === "2026-10-14")?.planMinuten).toBe(0);
    expect(tage.find((t) => t.tag === "2026-10-24")?.planMinuten).toBe(540);

    // Heute / day view uses the planned Soll too
    const tag6 = await json(await sandra.anfrage("/api/v1/arbeitszeit/tag?datum=2026-10-06"));
    expect(tag6.sollMinuten).toBe(480);
    const tag14 = await json(await sandra.anfrage("/api/v1/arbeitszeit/tag?datum=2026-10-14"));
    expect(tag14.sollMinuten).toBe(0);
    const tag24 = await json(await sandra.anfrage("/api/v1/arbeitszeit/tag?datum=2026-10-24"));
    expect(tag24.sollMinuten).toBe(540);
  });

  it("works for a person without an assigned working-time model when Soll comes from the plan", async () => {
    const { server, jonas, schichtAnlegen, veroeffentlichen, quelleSetzen } =
      await betriebMitPlan();
    const tom = await server.eingeladen(jonas, "mitarbeiter", "tom");
    await quelleSetzen("2026-10-01", "plan");
    await schichtAnlegen({
      tag: "2026-10-05",
      beginnMinute: 9 * 60,
      endeMinute: 15 * 60,
      nutzerId: tom.nutzerId,
    });
    expect((await veroeffentlichen("2026-10-05")).status).toBe(200);

    const monat = await json(
      await jonas.anfrage(`/api/v1/arbeitszeit/monat?monat=2026-10&nutzerId=${tom.nutzerId}`),
    );
    const inhalt = monat.inhalt as Json;
    expect(inhalt.nichtHinterlegt).toEqual([]);
    expect((inhalt.summen as Json).sollMinuten).toBe(360);
  });
});

describe("Soll aus dem Plan: closed months, Prüfwert and shift lock", () => {
  it("keeps the Prüfwert of an already closed model month and refuses changing its source", async () => {
    const { server, jonas, pruefwert } = await abgeschlossen();
    await jonas.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });

    const gesperrt = await jonas.anfrage("/api/v1/arbeitszeit/sollquellen", {
      method: "PUT",
      body: { ab: "2026-10-15", quelle: "plan" },
    });
    expect(gesperrt.status).toBe(409);
    expect((await json(gesperrt)).fehler).toBe("monat_gesperrt");

    const abNov = await jonas.anfrage("/api/v1/arbeitszeit/sollquellen", {
      method: "PUT",
      body: { ab: "2026-11-01", quelle: "plan" },
    });
    expect(abNov.status).toBe(200);
    expect((await json(abNov)).fruehestens).toBe("2026-11-01");

    // October's Prüfwert stays valid
    const geprueft = await pruefen(server, jonas.betriebId, pruefwert);
    expect(geprueft.ergebnis).toBe("uebereinstimmend");
  });

  it("locks published shifts in a closed plan-Soll month and detects direct DB tampering on Prüfseite", async () => {
    const { server, jonas, sandra, anna, schichtAnlegen, veroeffentlichen, quelleSetzen } =
      await betriebMitPlan();
    await quelleSetzen("2026-10-01", "plan");
    const schicht = await schichtAnlegen({
      tag: "2026-10-06",
      beginnMinute: 8 * 60,
      endeMinute: 16 * 60,
      nutzerId: sandra.nutzerId,
    });
    const schichtAnna = await schichtAnlegen({
      tag: "2026-10-06",
      beginnMinute: 8 * 60,
      endeMinute: 14 * 60,
      nutzerId: anna.nutzerId,
    });
    expect((await veroeffentlichen("2026-10-06")).status).toBe(200);

    // Close Sandra's October (Anna's October stays open)
    expect((await bestaetigen(sandra, "2026-10")).status).toBe(201);
    const abschluss = await json(await abschliessen(jonas, sandra.nutzerId));
    const pruefwert = (abschluss.abschluss as Json).pruefwert as string;

    // Stundenzettel PDF works and Prüfseite matches
    const pdf = await sandra.anfrage("/api/v1/arbeitszeit/monat/stundenzettel?monat=2026-10");
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect((await pruefen(server, jonas.betriebId, pruefwert)).ergebnis).toBe("uebereinstimmend");

    // Editing or deleting Sandra's published shift in closed October is refused (409)
    const edit = await jonas.anfrage(`/api/v1/dienstplan/schichten/${schicht.schichtId}`, {
      method: "PATCH",
      body: { endeMinute: 17 * 60 },
    });
    expect(edit.status).toBe(409);
    expect((await json(edit)).fehler).toBe("monat_abgeschlossen");

    const del = await jonas.anfrage(`/api/v1/dienstplan/schichten/${schicht.schichtId}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(409);
    expect((await json(del)).fehler).toBe("monat_abgeschlossen");

    // Publishing a new draft into Sandra's closed October is also refused (409)
    await schichtAnlegen({
      tag: "2026-10-08",
      beginnMinute: 8 * 60,
      endeMinute: 12 * 60,
      nutzerId: sandra.nutzerId,
    });
    const pub = await veroeffentlichen("2026-10-08");
    expect(pub.status).toBe(409);
    expect((await json(pub)).fehler).toBe("monat_abgeschlossen");

    // Editing Anna's published shift (her October is still open) succeeds
    const editAnna = await jonas.anfrage(`/api/v1/dienstplan/schichten/${schichtAnna.schichtId}`, {
      method: "PATCH",
      body: { endeMinute: 15 * 60 },
    });
    expect(editAnna.status).toBe(200);

    // Audit chain is clean before tampering
    expect(kettePruefen(server.db, jonas.betriebId)).toEqual([]);

    // Tampering directly with Sandra's shift in SQLite shows up on the Prüfseite
    server.sqlite
      .query("UPDATE schichten SET pause_minuten = 60 WHERE schicht_id = ?")
      .run(schicht.schichtId as string);
    const nachher = await pruefen(server, jonas.betriebId, pruefwert);
    expect(nachher.ergebnis).toBe("abweichung");
    expect(nachher.tage).toEqual(["2026-10-06"]);
  });
});
