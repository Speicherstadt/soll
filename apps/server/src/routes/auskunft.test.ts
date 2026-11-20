import { getTableName } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import * as authSchema from "../db/auth-schema.ts";
import * as schema from "../db/schema.ts";
import { ABDECKUNG, INHABERKOPIE } from "../modules/auskunft/index.ts";
import { testAbo } from "../modules/erinnerungen/push-test.ts";
import { abgeschlossen, type Json, json, type Person, weber } from "./monat-testhilfen.ts";

const auskunft = (wer: Person, nutzerId?: string) =>
  wer.anfrage(`/api/v1/auskunft${nutzerId ? `?nutzerId=${nutzerId}` : ""}`);
const liste = (daten: Json, teil: string) => daten[teil] as Json[];

const tabellen = (modul: Record<string, unknown>) =>
  Object.values(modul)
    .filter((wert): wert is SQLiteTable => wert instanceof SQLiteTable)
    .map(getTableName);

describe("GET /api/v1/auskunft", () => {
  const alleTabellen = () => [...tabellen(schema), ...tabellen(authSchema)].sort();

  it("names every table of the database as covered or excepted with a reason", () => {
    expect(alleTabellen()).toEqual(Object.keys(ABDECKUNG).sort());
  });

  it("decides every table for the owner's copy of someone else's too: allowed or left out, with a reason", () => {
    // a new table fails here until someone decides whether the owner may see it (docs/plan.md)
    expect(alleTabellen()).toEqual(Object.keys(INHABERKOPIE).sort());
    for (const [tabelle, { grund }] of Object.entries(INHABERKOPIE))
      expect(grund.length, tabelle).toBeGreaterThan(10);
    // what the person's own copy leaves out, the owner's copy cannot hold
    for (const [tabelle, teil] of Object.entries(ABDECKUNG))
      if (teil.startsWith("ausgenommen")) expect(INHABERKOPIE[tabelle]?.frei, tabelle).toBe(false);
  });

  it("gives Sandra everything about her: stamps with every version and reason, closing, model", async () => {
    const w = await abgeschlossen();
    await w.jonas.anfrage("/api/v1/arbeitszeit/monat/gegeneintrag", {
      body: {
        nutzerId: w.sandra.nutzerId,
        tag: "2026-10-06",
        minuten: -15,
        grund: "Pause vergessen",
      },
    });
    const antwort = await auskunft(w.sandra);
    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(antwort.headers.get("content-disposition")).toBe(
      'attachment; filename="auskunft-2026-11-20.json"',
    );
    const daten = await json(antwort);
    expect(daten.art).toBe("Auskunft nach Art. 15 DSGVO");
    expect(daten.verantwortlicher).toEqual({
      betrieb: "Weber Haustechnik",
      betriebId: w.jonas.betriebId,
    });
    expect(Object.keys(daten.hinweise as Json).sort()).toEqual([
      "automatisierteEntscheidung",
      "empfaenger",
      "herkunft",
      "rechte",
      "rechtsgrundlage",
      "speicherdauer",
      "zwecke",
    ]);
    expect((daten.konto as Json).name).toBe("sandra");
    expect((daten.mitgliedschaft as Json).rolle).toBe("mitarbeiter");
    const stempel = liste(daten, "stempelungen");
    expect(stempel).toHaveLength(6);
    expect(stempel[0]).toMatchObject({
      art: "kommen",
      zeitpunkt: "2026-10-06T06:00:00.000Z",
      grund: "Zettel",
      erfasstVon: "sandra",
      erfasstAm: "2026-11-20T08:00:00.000Z",
    });
    expect(liste(daten, "gegeneintraege")).toEqual([
      expect.objectContaining({
        tag: "2026-10-06",
        minuten: -15,
        grund: "Pause vergessen",
        von: "Inhaber Weber Haustechnik",
      }),
    ]);
    const abschluss = liste(daten, "monatsabschluesse").find((a) => a.schritt === "abgeschlossen");
    expect(abschluss?.pruefwert).toBe(w.pruefwert);
    expect(
      liste(daten, "monatsabschluesse").find((a) => a.schritt === "bestaetigt")?.pruefwert,
    ).toBeNull();
    expect(liste(daten, "arbeitszeitmodelle")[0]).toMatchObject({
      gueltigAb: "2026-10-01",
      modell: { name: "Vollzeit", lohnArt: "monat", lohnCent: null, minijob: false },
    });
    const kette = daten.auditKette as { zuDeinenDaten: Json[]; vonDir: Json[] };
    const tabellenDerKette = new Set(kette.zuDeinenDaten.map((g) => g.tabelle));
    for (const t of [
      "stempelungen",
      "korrekturen",
      "monatsabschluesse",
      "modellzuordnungen",
      "mitgliedschaften",
    ])
      expect(tabellenDerKette, t).toContain(t);
    expect(kette.vonDir.length).toBeGreaterThan(0);
    for (const glied of kette.vonDir)
      expect(Object.keys(glied).sort()).toEqual(["aktion", "nr", "tabelle", "zeitpunkt"]);
  });

  it("holds the person's reminder wishes and push devices, without the subscription", async () => {
    const w = await weber();
    const abo = testAbo("https://fcm.googleapis.com/fcm/send/sandra").json;
    const pfad = "/api/v1/arbeitszeit/erinnerungen";
    expect(
      (await w.sandra.anfrage(`${pfad}/abos`, { body: { ...abo, sprache: "pl" } })).status,
    ).toBeLessThan(300);
    const wuensche = { ausstempeln: false, pause: true, monat: true, mail: false };
    await w.sandra.anfrage(`${pfad}/wuensche`, { method: "PUT", body: wuensche });
    const antwort = await auskunft(w.sandra);
    const text = await antwort.clone().text();
    const daten = await json(antwort);
    expect(daten.erinnerungseinstellungen).toEqual(wuensche);
    expect(liste(daten, "pushAbos")).toEqual([expect.objectContaining({ sprache: "pl" })]);
    expect(text).not.toContain(abo.endpoint);
    expect(text).not.toContain(abo.keys.auth);
    const kette = daten.auditKette as { zuDeinenDaten: Json[] };
    expect(kette.zuDeinenDaten.map((g) => g.tabelle)).toEqual(
      expect.arrayContaining(["pushAbos", "erinnerungseinstellungen"]),
    );
  });

  it("holds no secrets and nothing of other people", async () => {
    const w = await abgeschlossen();
    const text = await (await auskunft(w.sandra)).text();
    for (const geheim of ["password", "token", "pinHash", "pin_hash", "tokenHash", 'signatur"'])
      expect(text, geheim).not.toContain(geheim);
    // Jonas's own rows and Anna's name are not in it; Jonas appears only as who changed her records
    const jonas = await json(await auskunft(w.jonas));
    expect(text).not.toContain(w.jonas.nutzerId);
    expect(text).not.toContain('"anna"');
    for (const s of liste(jonas, "stempelungen")) expect(text).not.toContain(s.stempelId as string);
    // the owner's links on Sandra's rows name no row in the owner's Auskunft
    const jonasText = JSON.stringify(jonas);
    for (const s of liste(await json(await auskunft(w.sandra)), "stempelungen"))
      expect(jonasText).not.toContain(s.stempelId as string);
  });

  it("is given by the owner for someone who left, and by nobody else for another person", async () => {
    const w = await weber();
    const organisation = await json(
      await w.jonas.anfrage(
        `/api/auth/organization/get-full-organization?organizationId=${w.jonas.betriebId}`,
      ),
    );
    const memberId = (organisation.members as { id: string; userId: string }[]).find(
      (m) => m.userId === w.sandra.nutzerId,
    )?.id;
    for (const wer of [w.anna, w.lohn])
      expect((await auskunft(wer, w.sandra.nutzerId)).status).toBe(403);
    expect(
      (
        await w.jonas.anfrage("/api/auth/organization/remove-member", {
          body: { memberIdOrEmail: memberId, organizationId: w.jonas.betriebId },
        })
      ).status,
    ).toBe(200);
    const antwort = await auskunft(w.jonas, w.sandra.nutzerId);
    expect(antwort.status).toBe(200);
    const daten = await json(antwort);
    expect(daten.mitgliedschaft).toBeNull();
    expect(liste(daten, "stempelungen")).toHaveLength(6);
    expect((await auskunft(w.jonas, "niemand")).status).toBe(404);
    expect((await w.jonas.anfrage("/api/v1/auskunft?anders=1")).status).toBe(400);
  });

  it("is given to external staff for themselves, and to nobody without sign-in", async () => {
    const w = await weber();
    const extern = await w.server.eingeladen(w.jonas, "extern", "extern");
    const daten = await json(await auskunft(extern));
    expect((daten.mitgliedschaft as Json).rolle).toBe("extern");
    expect(liste(daten, "stempelungen")).toEqual([]);
    expect((await w.server.browser().anfrage("/api/v1/auskunft")).status).toBe(401);
  });

  it("does not reach a person of another business", async () => {
    const w = await abgeschlossen();
    const mia = await w.server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    expect((await auskunft(mia, w.sandra.nutzerId)).status).toBe(404);
    const eigen = await json(await auskunft(mia));
    expect(eigen.verantwortlicher).toMatchObject({ betrieb: "Café Elbblick" });
    expect(liste(eigen, "stempelungen")).toEqual([]);
    expect(JSON.stringify(eigen)).not.toContain(w.jonas.betriebId);
  });
});
