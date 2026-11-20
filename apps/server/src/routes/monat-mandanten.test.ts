import { describe, expect, it } from "vitest";
import { abgeschlossen, json, pruefen } from "./monat-testhilfen.ts";

/** Weber with Sandra's October closed, and Café Elbblick with Mia and Tom */
const zwei = async () => {
  const weber = await abgeschlossen();
  const mia = await weber.server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  const tom = await weber.server.eingeladen(mia, "mitarbeiter", "tom");
  return { ...weber, mia, tom };
};

const zeilen = (server: Awaited<ReturnType<typeof zwei>>["server"], tabelle: string) =>
  server.sqlite.query(`SELECT * FROM ${tabelle} ORDER BY rowid`).all();

describe("no business sees or changes another's months", () => {
  it("GET /api/v1/arbeitszeit/monat does not show a person of another business", async () => {
    const { mia, sandra } = await zwei();
    const antwort = await mia.anfrage(
      `/api/v1/arbeitszeit/monat?monat=2026-10&nutzerId=${sandra.nutzerId}`,
    );
    expect(antwort.status).toBe(404);
    const eigen = await json(await mia.anfrage("/api/v1/arbeitszeit/monat?monat=2026-10"));
    expect(eigen.abschluss).toBeNull();
    expect(
      (eigen.inhalt as { tage: { stempel: unknown[] }[] }).tage.flatMap((t) => t.stempel),
    ).toEqual([]);
  });

  it("GET /api/v1/arbeitszeit/monat/stundenzettel does not give another business's sheet", async () => {
    const { mia, sandra } = await zwei();
    const antwort = await mia.anfrage(
      `/api/v1/arbeitszeit/monat/stundenzettel?monat=2026-10&nutzerId=${sandra.nutzerId}`,
    );
    expect(antwort.status).toBe(404);
  });

  it("POST /api/v1/arbeitszeit/monat/bestaetigen confirms in one's own business only", async () => {
    const { server, tom, mia } = await zwei();
    expect(
      (await tom.anfrage("/api/v1/arbeitszeit/monat/bestaetigen", { body: { monat: "2026-10" } }))
        .status,
    ).toBe(201);
    expect(
      server.sqlite
        .query("SELECT betrieb_id FROM monatsabschluesse WHERE nutzer_id = ?")
        .all(tom.nutzerId),
    ).toEqual([{ betrieb_id: mia.betriebId }]);
  });

  it("POST /api/v1/arbeitszeit/monat/abschliessen does not reach a person of another business", async () => {
    const { server, mia, sandra } = await zwei();
    const vorher = zeilen(server, "monatsabschluesse");
    const antwort = await mia.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat: "2026-09", nutzerId: sandra.nutzerId, grund: "x" },
    });
    expect(antwort.status).toBe(404);
    expect(zeilen(server, "monatsabschluesse")).toEqual(vorher);
  });

  it("POST /api/v1/arbeitszeit/monat/gegeneintrag does not reach a person of another business", async () => {
    const { server, mia, sandra } = await zwei();
    const antwort = await mia.anfrage("/api/v1/arbeitszeit/monat/gegeneintrag", {
      body: { nutzerId: sandra.nutzerId, tag: "2026-10-06", minuten: 30, grund: "x" },
    });
    expect(antwort.status).toBe(404);
    expect(zeilen(server, "korrekturen")).toEqual([]);
  });

  it("POST /api/v1/pruefen checks a Prüfwert only against the business it names", async () => {
    const { server, mia, jonas, pruefwert } = await zwei();
    expect((await pruefen(server, jonas.betriebId, pruefwert)).ergebnis).toBe("uebereinstimmend");
    const fremd = await pruefen(server, mia.betriebId, pruefwert);
    expect(fremd.ergebnis).not.toBe("uebereinstimmend");
    expect(fremd).not.toHaveProperty("name");
    expect(fremd).not.toHaveProperty("monat");
  });
});
