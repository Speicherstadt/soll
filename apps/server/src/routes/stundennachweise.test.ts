import { describe, expect, it } from "vitest";
import { kanonisch, sha256 } from "../modules/audit/index.ts";
import { json, PZ } from "./projektzeit-testhilfen.ts";
import { um } from "./stoppuhr-testhilfen.ts";
import {
  baustelle,
  SN,
  tageFrage,
  UNTERSCHRIFT,
  unterschreiben,
  vorschau,
} from "./stundennachweis-testhilfen.ts";

type Zeile = Record<string, unknown>;

describe("GET /stundennachweise/vorschau (S-605)", () => {
  it("lists the finished bookings on the order in the span, everyone's for the owner", async () => {
    const w = await baustelle();
    const antwort = await vorschau(w.weber, tageFrage(w.projekt.projektId));
    expect(antwort.status).toBe(200);
    const daten = await json(antwort);
    expect(daten).toMatchObject({
      kunde: { name: "Elbhof", nummer: "K-1001" },
      auftrag: { name: "Bad Elbhof", nummer: "" },
      von: "2026-11-19",
      bis: "2026-11-20",
      summeMinuten: 255,
    });
    expect(daten.zeilen).toEqual([
      {
        buchungId: w.sandraMontage.buchungId,
        tag: "2026-11-20",
        person: "sandra",
        beginn: um("08:00"),
        ende: um("11:30"),
        minuten: 210,
        taetigkeit: "Montage",
        notiz: "Vorwand gesetzt",
      },
      expect.objectContaining({
        buchungId: w.jonasFahrt.buchungId,
        person: "Inhaber Weber Haustechnik",
        minuten: 45,
        // the fixed activities in German, like the PDF
        taetigkeit: "Fahrt",
      }),
    ]);
    expect(daten.stand).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives an employee only their own bookings and refuses another person", async () => {
    const w = await baustelle();
    const eigene = await json(await vorschau(w.sandra, tageFrage(w.projekt.projektId)));
    expect((eigene.zeilen as Zeile[]).map((z) => z.buchungId)).toEqual([w.sandraMontage.buchungId]);
    const fremd = await vorschau(
      w.sandra,
      tageFrage(w.projekt.projektId, { nutzerId: w.weber.nutzerId }),
    );
    expect(fremd.status).toBe(403);
    const nurSandra = await json(
      await vorschau(w.weber, tageFrage(w.projekt.projektId, { nutzerId: w.sandra.nutzerId })),
    );
    expect(nurSandra.summeMinuten).toBe(210);
  });

  it("leaves out a running booking and refuses a wrong span or order", async () => {
    const w = await baustelle();
    await w.sandra.anfrage(`${PZ}/stoppuhr/start`, {
      body: { projektId: w.projekt.projektId, taetigkeitId: "fahrt" },
    });
    const daten = await json(await vorschau(w.weber, tageFrage(w.projekt.projektId)));
    expect(daten.summeMinuten).toBe(255);
    const falsch = [
      { projektId: w.projekt.projektId, von: "2026-11-21", bis: "2026-11-20" },
      { projektId: w.projekt.projektId, von: "2025-11-01", bis: "2026-11-20" },
      { projektId: w.projekt.projektId, von: "2026-11-31", bis: "2026-12-01" },
    ];
    for (const frage of falsch) expect((await vorschau(w.weber, frage)).status).toBe(400);
    const unbekannt = await vorschau(w.weber, tageFrage("kein-auftrag"));
    expect(unbekannt.status).toBe(422);
  });
});

describe("POST /stundennachweise (S-605)", () => {
  it("signs the report: number, frozen content and its SHA-256, the time from the server", async () => {
    const w = await baustelle();
    const antwort = await unterschreiben(w.weber, tageFrage(w.projekt.projektId), {
      bemerkung: "2 Eckventile",
    });
    expect(antwort.status).toBe(201);
    const nachweis = await json(antwort);
    expect(nachweis).toMatchObject({
      nummer: 1,
      projektId: w.projekt.projektId,
      nutzerId: null,
      unterzeichner: "Erika Elbhof",
      unterschriebenAm: um("18:00"),
      summeMinuten: 255,
    });
    const inhalt = nachweis.inhalt as Record<string, unknown>;
    expect(inhalt).toMatchObject({
      nummer: 1,
      betrieb: "Weber Haustechnik",
      bemerkung: "2 Eckventile",
      unterschrift: { name: "Erika Elbhof", am: um("18:00"), striche: UNTERSCHRIFT },
    });
    expect(nachweis.inhaltHash).toBe(sha256(kanonisch(inhalt)));
    const zweiter = await json(
      await unterschreiben(w.weber, {
        projektId: w.projekt.projektId,
        von: "2026-11-18",
        bis: "2026-11-18",
      }),
    );
    expect(zweiter.nummer).toBe(2);
  });

  it("locks its bookings: no change, no removal, but billing goes on", async () => {
    const w = await baustelle();
    await unterschreiben(w.sandra, tageFrage(w.projekt.projektId));
    const pfad = `${PZ}/buchungen/${w.sandraMontage.buchungId}`;
    const aendern = await w.sandra.anfrage(pfad, { method: "PATCH", body: { notiz: "x" } });
    expect(aendern.status).toBe(409);
    expect(await json(aendern)).toEqual({ fehler: "unterschrieben" });
    expect((await w.weber.anfrage(pfad, { method: "DELETE" })).status).toBe(409);
    const abrechnen = await w.weber.anfrage(`${PZ}/buchungen/abrechnen`, {
      body: { buchungIds: [w.sandraMontage.buchungId] },
    });
    expect(abrechnen.status).toBe(200);
    // Jonas's booking is in no report and stays open
    const offen = await w.weber.anfrage(`${PZ}/buchungen/${w.jonasFahrt.buchungId}`, {
      method: "PATCH",
      body: { notiz: "Anfahrt" },
    });
    expect(offen.status).toBe(200);
  });

  it("puts a booking in one report at most", async () => {
    const w = await baustelle();
    const frage = tageFrage(w.projekt.projektId);
    const stand = (await json(await vorschau(w.weber, frage))).stand;
    const body = { ...frage, stand, unterzeichner: "Erika Elbhof", unterschrift: UNTERSCHRIFT };
    // two signatures at once over the same preview: one wins
    const [eins, zwei] = await Promise.all([
      w.weber.anfrage(SN, { body }),
      w.weber.anfrage(SN, { body }),
    ]);
    expect([eins.status, zwei.status].sort()).toEqual([201, 409]);
    const danach = await json(await vorschau(w.weber, frage));
    expect(danach.zeilen).toEqual([]);
    const leer = await unterschreiben(w.weber, frage);
    expect(leer.status).toBe(422);
    expect(await json(leer)).toEqual({ fehler: "leer" });
  });

  it("refuses to sign when a booking changed since the preview, and writes nothing", async () => {
    const w = await baustelle();
    const frage = tageFrage(w.projekt.projektId);
    const stand = (await json(await vorschau(w.weber, frage))).stand;
    await w.sandra.anfrage(`${PZ}/buchungen/${w.sandraMontage.buchungId}`, {
      method: "PATCH",
      body: { ende: um("12:00") },
    });
    const antwort = await w.weber.anfrage(SN, {
      body: { ...frage, stand, unterzeichner: "Erika Elbhof", unterschrift: UNTERSCHRIFT },
    });
    expect(antwort.status).toBe(409);
    expect(await json(antwort)).toEqual({ fehler: "abweichung" });
    expect((await json(await w.weber.anfrage(SN))).nachweise).toEqual([]);
  });

  it("refuses a signature without a line, with fractions, timing or pressure, and no name", async () => {
    const w = await baustelle();
    const frage = tageFrage(w.projekt.projektId);
    const falsch = [
      { unterschrift: [[[20, 150]]] },
      { unterschrift: [] },
      {
        unterschrift: [
          [
            [20.5, 150],
            [30, 40],
          ],
        ],
      },
      {
        unterschrift: [
          [
            [20, 150, 1_790_000_000_000],
            [30, 40, 1_790_000_000_016],
          ],
        ],
      },
      {
        unterschrift: [
          [
            [700, 150],
            [30, 40],
          ],
        ],
      },
      { unterzeichner: " " },
      { bemerkung: "x".repeat(2_001) },
      { zeit: 123 },
    ];
    for (const mehr of falsch)
      expect((await unterschreiben(w.weber, frage, mehr)).status, JSON.stringify(mehr)).toBe(400);
    const fremd = await w.sandra.anfrage(SN, {
      body: {
        ...frage,
        nutzerId: w.weber.nutzerId,
        stand: "0".repeat(64),
        unterzeichner: "Erika Elbhof",
        unterschrift: UNTERSCHRIFT,
      },
    });
    expect(fremd.status).toBe(403);
  });
});

describe("GET /stundennachweise (S-605)", () => {
  it("lists all for the owner, an employee's own for the employee", async () => {
    const w = await baustelle();
    await unterschreiben(w.sandra, tageFrage(w.projekt.projektId));
    await unterschreiben(w.weber, tageFrage(w.projekt.projektId));
    const alle = (await json(await w.weber.anfrage(SN))).nachweise as Zeile[];
    expect(alle.map((n) => [n.nummer, n.summeMinuten])).toEqual([
      [2, 45],
      [1, 210],
    ]);
    expect(alle[1]).toMatchObject({
      nutzerId: w.sandra.nutzerId,
      kunde: "Elbhof",
      auftrag: "Bad Elbhof",
      unterzeichner: "Erika Elbhof",
    });
    expect(alle[1]).not.toHaveProperty("inhalt");
    const eigene = (await json(await w.sandra.anfrage(SN))).nachweise as Zeile[];
    expect(eigene.map((n) => n.nummer)).toEqual([1]);
    const nummerZwei = alle[0]?.nachweisId as string;
    expect((await w.sandra.anfrage(`${SN}/${nummerZwei}`)).status).toBe(404);
    expect((await w.sandra.anfrage(`${SN}/${nummerZwei}/pdf`)).status).toBe(404);
    expect((await w.weber.anfrage(`${SN}/${nummerZwei}`)).status).toBe(200);
  });

  it("gives the PDF, the same file each time, with the signer and the SHA-256", async () => {
    const w = await baustelle();
    const nachweis = await json(await unterschreiben(w.sandra, tageFrage(w.projekt.projektId)));
    const pfad = `${SN}/${nachweis.nachweisId}/pdf`;
    const antwort = await w.sandra.anfrage(pfad);
    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("content-type")).toBe("application/pdf");
    expect(antwort.headers.get("content-disposition")).toBe(
      'attachment; filename="stundennachweis-1.pdf"',
    );
    const eins = Buffer.from(await antwort.arrayBuffer());
    const { pdfText } = await import("@soll/export");
    const text = pdfText(eins);
    expect(text).toContain("Stundennachweis Nr. 1");
    expect(text).toContain("Unterschrieben von Erika Elbhof am 20.11.2026 18:00");
    expect(text).toContain(`SHA-256 des Inhalts: ${nachweis.inhaltHash}`);
    const zwei = Buffer.from(await (await w.weber.anfrage(pfad)).arrayBuffer());
    expect(eins.equals(zwei)).toBe(true);
  });

  it("writes the report and its bookings through the audit chain, the hash in the link", async () => {
    const w = await baustelle();
    const nachweis = await json(await unterschreiben(w.sandra, tageFrage(w.projekt.projektId)));
    const inhalte = w.server.sqlite
      .query("select inhalt from audit_inhalte where inhalt like ?")
      .all(`%${nachweis.inhaltHash}%`) as { inhalt: string }[];
    expect(inhalte).toHaveLength(1);
    const gesperrt = w.server.sqlite
      .query("select count(*) as n from audit_glieder where tabelle = 'stundennachweisBuchungen'")
      .get() as { n: number };
    expect(gesperrt.n).toBe(1);
  });
});
