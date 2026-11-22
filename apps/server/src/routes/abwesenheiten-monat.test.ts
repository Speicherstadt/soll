import { pdfText } from "@soll/export";
import { describe, expect, it } from "vitest";
import {
  angelegt,
  antrag,
  genehmigt,
  type Json,
  json,
  krank,
  liste,
  schritt,
  um,
  weberMitAbwesenheiten,
} from "./abwesenheit-testhilfen.ts";
import { abschliessen, bestaetigen, pruefen } from "./monat-testhilfen.ts";

type Tag = { tag: string; abwesenheiten?: Json[] };
type Inhalt = { tage: Tag[]; summen: Json | null; befunde: Json[] };

const monat = async (wer: Parameters<typeof liste>[0], m: string, nutzerId?: string) =>
  json(
    await wer.anfrage(
      `/api/v1/arbeitszeit/monat?monat=${m}${nutzerId ? `&nutzerId=${nutzerId}` : ""}`,
    ),
  );
const inhalt = async (wer: Parameters<typeof liste>[0], m: string) =>
  (await monat(wer, m)).inhalt as Inhalt;

describe("Abwesenheiten in Soll und Ist des Monats (S-401)", () => {
  it("credits approved leave to Ist and records it on its days and the time sheet", async () => {
    const w = await weberMitAbwesenheiten();
    await genehmigt(w, w.sandra, { von: "2026-10-07", bis: "2026-10-08", letzterHalb: true });
    const oktober = await inhalt(w.sandra, "2026-10");
    // 8:00 on the 6th and 6:00 of the night shift on the 31st worked; leave on the 7th and half the
    // 8th: 8:00 + 4:00 credited
    expect(oktober.summen).toMatchObject({ gearbeitetMinuten: 840, gutschriftMinuten: 720 });
    expect(oktober.tage.find((t) => t.tag === "2026-10-07")?.abwesenheiten).toEqual([
      { art: "urlaub" },
    ]);
    expect(oktober.tage.find((t) => t.tag === "2026-10-08")?.abwesenheiten).toEqual([
      { art: "urlaub", halb: true },
    ]);
    // a day without an absence keeps the form of S-306
    expect(Object.keys(oktober.tage.find((t) => t.tag === "2026-10-06") ?? {}).sort()).toEqual([
      "modellMinuten",
      "stempel",
      "tag",
    ]);
    const pdf = await w.sandra.anfrage("/api/v1/arbeitszeit/monat/stundenzettel?monat=2026-10");
    const text = pdfText(new Uint8Array(await pdf.arrayBuffer()));
    expect(text).toContain("Urlaub (halber Tag)");
    expect(text).toContain("davon Gutschrift 12:00");
  });

  it("counts a request only once it is approved", async () => {
    const w = await weberMitAbwesenheiten();
    await angelegt(antrag(w.sandra, { art: "urlaub", von: "2026-10-07", bis: "2026-10-07" }));
    expect((await inhalt(w.sandra, "2026-10")).summen).toMatchObject({ gutschriftMinuten: 0 });
  });

  it("takes off overtime without a credit", async () => {
    const w = await weberMitAbwesenheiten();
    await genehmigt(w, w.sandra, {
      art: "ueberstundenabbau",
      von: "2026-10-07",
      bis: "2026-10-07",
    });
    expect((await inhalt(w.sandra, "2026-10")).summen).toMatchObject({ gutschriftMinuten: 0 });
  });
});

describe("Krank im Urlaub (§ 9 BUrlG, R-24)", () => {
  it("counts sick days in leave as leave without a certificate, as sickness with one", async () => {
    const w = await weberMitAbwesenheiten();
    await genehmigt(w, w.sandra, { von: "2026-11-23", bis: "2026-11-27" });
    w.server.stelleUhr(um("2026-11-25T08:00:00+01:00"));
    const id = await angelegt(krank(w.sandra, { art: "krank", bis: "2026-11-27" }));
    // a child's sickness may not fall into leave: § 9 BUrlG is about one's own
    expect((await krank(w.max, { art: "kind_krank", kind: "1" })).status).toBe(201);

    expect((await liste(w.sandra)).urlaub).toMatchObject({ genommenHalbtage: 10 });
    const ohne = await inhalt(w.sandra, "2026-11");
    expect(ohne.befunde).toEqual([
      expect.objectContaining({
        regel: "R-24",
        norm: "§ 9 BUrlG",
        art: "bescheinigung_fehlt",
        tage: ["2026-11-25", "2026-11-26", "2026-11-27"],
      }),
    ]);

    await schritt(w.sandra, id, "bescheinigung", { bescheinigung: "papier" });
    expect((await liste(w.sandra)).urlaub).toMatchObject({ genommenHalbtage: 4, restHalbtage: 6 });
    const mit = await inhalt(w.sandra, "2026-11");
    expect(mit.befunde.filter((b) => b.regel === "R-24")).toEqual([]);
    expect(mit.summen).toMatchObject({ gutschriftMinuten: 5 * 480 });
    expect(mit.tage.find((t) => t.tag === "2026-11-25")?.abwesenheiten).toEqual([
      { art: "urlaub" },
      { art: "krank", bescheinigung: true },
    ]);
  });

  it("refuses leave over a child's sickness and any two other absences on a day", async () => {
    const w = await weberMitAbwesenheiten();
    await angelegt(krank(w.sandra, { art: "kind_krank", kind: "1", bis: "2026-11-24" }));
    expect(
      (await antrag(w.sandra, { art: "urlaub", von: "2026-11-24", bis: "2026-11-25" })).status,
    ).toBe(409);
    expect(
      (await antrag(w.sandra, { art: "urlaub", von: "2026-11-25", bis: "2026-11-25" })).status,
    ).toBe(201);
  });
});

describe("Abgeschlossener Monat (S-306)", () => {
  const geschlossen = async () => {
    const w = await weberMitAbwesenheiten();
    const id = await genehmigt(w, w.sandra, { von: "2026-10-07", bis: "2026-10-07" });
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    const antwort = await json(await abschliessen(w.jonas, w.sandra.nutzerId));
    return { ...w, id, pruefwert: (antwort.abschluss as Json).pruefwert as string };
  };

  it("closes the month with its absences and keeps them locked", async () => {
    const w = await geschlossen();
    const abschluss = (await monat(w.sandra, "2026-10")).abschluss as { inhalt: Inhalt };
    expect(abschluss.inhalt.tage.find((t) => t.tag === "2026-10-07")?.abwesenheiten).toEqual([
      { art: "urlaub" },
    ]);
    const storno = await schritt(w.jonas, w.id, "stornieren", { grund: "Irrtum" });
    expect(storno.status).toBe(409);
    expect(await json(storno)).toEqual({ fehler: "abgeschlossen" });
    expect(
      (await antrag(w.sandra, { art: "urlaub", von: "2026-10-20", bis: "2026-10-20" })).status,
    ).toBe(409);
    expect(
      (await antrag(w.sandra, { art: "urlaub", von: "2026-10-30", bis: "2026-11-02" })).status,
    ).toBe(409);
    expect(
      (await antrag(w.sandra, { art: "urlaub", von: "2026-11-02", bis: "2026-11-02" })).status,
    ).toBe(201);
    expect((await pruefen(w.server, w.jonas.betriebId, w.pruefwert)).ergebnis).toBe(
      "uebereinstimmend",
    );
  });

  it("shows an absence written past the lock as a deviation on the check page", async () => {
    const w = await geschlossen();
    w.server.sqlite.run("UPDATE abwesenheiten SET status = 'storniert' WHERE abwesenheit_id = ?", [
      w.id,
    ]);
    const ergebnis = await pruefen(w.server, w.jonas.betriebId, w.pruefwert);
    expect(ergebnis).toMatchObject({ ergebnis: "abweichung", grund: "tage", tage: ["2026-10-07"] });
  });

  it("keeps the content of a month without absences as S-306 closed it", async () => {
    const w = await weberMitAbwesenheiten();
    await bestaetigen(w.sandra);
    await abschliessen(w.jonas, w.sandra.nutzerId);
    const zeile = w.server.sqlite
      .query("SELECT inhalt FROM monatsabschluesse WHERE schritt = 'abgeschlossen'")
      .get() as { inhalt: string };
    expect(zeile.inhalt).not.toContain("abwesenheiten");
  });
});
