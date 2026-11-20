import { describe, expect, it } from "vitest";
import { cafe, PFAD } from "./erinnerungen-testhilfen.ts";

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

/** Café Elbblick, and Weber Haustechnik with Jonas in the same instance */
const zwei = async () => {
  const c = await cafe();
  const jonas = await c.server.inhaberMitBetrieb("Weber Haustechnik", "weber");
  return { ...c, jonas };
};

const zeilen = (c: Awaited<ReturnType<typeof zwei>>, tabelle: string) =>
  c.server.sqlite.query(`SELECT * FROM ${tabelle} ORDER BY rowid`).all();

describe("no business sees or changes another's reminders", () => {
  it("GET shows the devices, wishes and times of one's own business only", async () => {
    const c = await zwei();
    await c.abonnieren(c.mia, "mia");
    await c.mia.anfrage(`${PFAD}/wuensche`, {
      method: "PUT",
      body: { ausstempeln: false, pause: false, monat: false, mail: false },
    });
    await c.mia.anfrage(`${PFAD}/regeln`, {
      method: "PUT",
      body: { gehenMinuten: 480, pauseVorlauf: 5, monatTag: 2 },
    });
    expect(await json(await c.jonas.anfrage(PFAD))).toMatchObject({
      wuensche: { ausstempeln: true, pause: true, monat: true, mail: true },
      regeln: { gehenMinuten: 600, pauseVorlauf: 15, monatTag: 1 },
      geraete: 0,
    });
  });

  it("PUT /wuensche writes in one's own business only", async () => {
    const c = await zwei();
    await c.jonas.anfrage(`${PFAD}/wuensche`, {
      method: "PUT",
      body: { ausstempeln: false, pause: true, monat: true, mail: true },
    });
    expect(zeilen(c, "erinnerungseinstellungen")).toEqual([
      expect.objectContaining({ betrieb_id: c.jonas.betriebId, nutzer_id: c.jonas.nutzerId }),
    ]);
    expect((await json(await c.mia.anfrage(PFAD))).wuensche).toMatchObject({ ausstempeln: true });
  });

  it("PUT /regeln sets the times of one's own business only", async () => {
    const c = await zwei();
    await c.jonas.anfrage(`${PFAD}/regeln`, {
      method: "PUT",
      body: { gehenMinuten: 480, pauseVorlauf: 5, monatTag: 2 },
    });
    expect(zeilen(c, "erinnerungsregeln")).toEqual([
      expect.objectContaining({ betrieb_id: c.jonas.betriebId }),
    ]);
    expect((await json(await c.tom.anfrage(PFAD))).regeln).toMatchObject({ gehenMinuten: 600 });
  });

  it("POST /abos registers in one's own business; the same device in another stays apart", async () => {
    const c = await zwei();
    const { geraet } = await c.abonnieren(c.tom, "geraet");
    const antwort = await c.jonas.anfrage(`${PFAD}/abos`, {
      body: { ...geraet.json, sprache: "de" },
    });
    expect(antwort.status).toBe(201);
    expect((await json(await c.tom.anfrage(PFAD))).geraete).toBe(1);
    expect(
      zeilen(c, "push_abos")
        .map((z) => (z as { betrieb_id: string }).betrieb_id)
        .sort(),
    ).toEqual([c.mia.betriebId, c.jonas.betriebId].sort());
  });

  it("DELETE /abos does not reach a device of another business", async () => {
    const c = await zwei();
    const { geraet } = await c.abonnieren(c.tom, "tom");
    const vorher = zeilen(c, "push_abos");
    const antwort = await c.jonas.anfrage(`${PFAD}/abos`, {
      method: "DELETE",
      body: { endpoint: geraet.json.endpoint },
    });
    expect(antwort.status).toBe(404);
    expect(zeilen(c, "push_abos")).toEqual(vorher);
  });

  it("the loop sends a business's reminders by its own times to its own people", async () => {
    const c = await zwei();
    await c.jonas.anfrage(`${PFAD}/regeln`, {
      method: "PUT",
      body: { gehenMinuten: 60, pauseVorlauf: 15, monatTag: 1 },
    });
    await c.abonnieren(c.tom, "tom");
    await c.stempeln(c.tom, "kommen", Date.parse("2026-11-18T07:00:00+01:00"));
    expect(await c.lauf(Date.parse("2026-11-18T08:30:00+01:00"))).toEqual([]);
    expect(zeilen(c, "erinnerungen")).toEqual([]);
  });
});
