import { describe, expect, it } from "vitest";
import { dateiText, exportPfad, PFAD, weberMitOktober, ZUORDNUNG } from "./datev-testhilfen.ts";
import { json } from "./monat-testhilfen.ts";

/** Weber with Sandra's October closed and mapped, and Café Elbblick with Mia and Tom */
const zwei = async () => {
  const weber = await weberMitOktober();
  await weber.zuordnung();
  const mia = await weber.server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  const tom = await weber.server.eingeladen(mia, "mitarbeiter", "tom");
  return { ...weber, mia, tom };
};

const zeilen = (w: Awaited<ReturnType<typeof zwei>>, tabelle: string) =>
  w.server.sqlite.query(`SELECT * FROM ${tabelle} ORDER BY rowid`).all();

describe("no business sees or changes another's DATEV export", () => {
  it("GET shows the mapping and the persons of one's own business only", async () => {
    const w = await zwei();
    const ansicht = await json(await w.mia.anfrage(PFAD));
    expect(ansicht).toMatchObject({ beraterNr: null, mandantenNr: null, lohnarten: {} });
    const ids = (ansicht.personen as { nutzerId: string }[]).map((p) => p.nutzerId);
    expect(ids).not.toContain(w.sandra.nutzerId);
    expect(ids).toContain(w.tom.nutzerId);
  });

  it("PUT writes in one's own business only and gives no number to another's person", async () => {
    const w = await zwei();
    const vorher = zeilen(w, "datev_personalnummern");
    const fremd = await w.mia.anfrage(PFAD, {
      method: "PUT",
      body: { ...ZUORDNUNG, personalnummern: { [w.sandra.nutzerId]: "7" } },
    });
    expect(fremd.status).toBe(404);
    expect(zeilen(w, "datev_personalnummern")).toEqual(vorher);
    const eigen = await w.mia.anfrage(PFAD, {
      method: "PUT",
      body: { ...ZUORDNUNG, beraterNr: "7654321", personalnummern: { [w.tom.nutzerId]: "101" } },
    });
    expect(eigen.status).toBe(200);
    expect(await json(await w.lohn.anfrage(PFAD))).toMatchObject({ beraterNr: "1234567" });
    // the same number in two businesses: each is its own payroll client
    expect(
      w.server.sqlite
        .query("SELECT betrieb_id FROM datev_personalnummern WHERE personalnummer = '101'")
        .all(),
    ).toHaveLength(2);
  });

  it("GET /export holds the closed months of one's own business only", async () => {
    const w = await zwei();
    const antwort = await w.mia.anfrage(exportPfad("2026-10", "lug"));
    expect(antwort.status).toBe(200);
    expect(await dateiText(antwort)).toBe("");
  });
});
