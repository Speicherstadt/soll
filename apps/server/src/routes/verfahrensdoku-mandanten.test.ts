import { describe, expect, it } from "vitest";
import { ANGABEN, type Doku, text, weber } from "./verfahrensdoku-testhilfen.ts";

/** Weber Haustechnik with its statements, and Café Elbblick with Mia, in one instance */
const zwei = async () => {
  const w = await weber();
  await w.jonas.anfrage("/api/v1/verfahrensdoku/angaben", { method: "PUT", body: ANGABEN });
  await w.jonas.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { terminal: true } });
  const terminal = await w.jonas.anfrage("/api/v1/terminal/geraete", {
    body: { name: "Werkstatt" },
  });
  if (terminal.status !== 201) throw new Error(`terminal ${terminal.status}`);
  const mia = await w.server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  return { ...w, mia };
};

const lesen = async (wer: { anfrage: (pfad: string) => Promise<Response> }) =>
  (await (await wer.anfrage("/api/v1/verfahrensdoku")).json()) as Doku;

describe("no business sees or changes another's Verfahrensdokumentation", () => {
  it("GET /api/v1/verfahrensdoku gives Mia her own business's state and statements only", async () => {
    const { mia } = await zwei();
    const { dokument, angaben } = await lesen(mia);
    expect(dokument.titel).toBe("Verfahrensdokumentation Café Elbblick");
    expect(angaben.rechtsform).toBe("");
    expect(angaben.eigene).toEqual([]);
    const inhalt = text(dokument);
    expect(inhalt).not.toMatch(/Weber|Wandsbek|Werkstatt|Einzelunternehmen|Papier vor Soll/);
    expect(inhalt).toContain("Mitarbeiter (0 Mitglieder)");
    expect(dokument.abschnitte.find((a) => a.titel.startsWith("11."))?.liste).toBeUndefined();
  });

  it("GET /api/v1/verfahrensdoku/datei gives Mia no line of Weber's", async () => {
    const { mia } = await zwei();
    const md = await (await mia.anfrage("/api/v1/verfahrensdoku/datei?format=md")).text();
    expect(md).toContain("# Verfahrensdokumentation Café Elbblick");
    expect(md).not.toMatch(/Weber|Wandsbek|Papier vor Soll/);
  });

  it("PUT /api/v1/verfahrensdoku/angaben changes Mia's statements, never Weber's", async () => {
    const { jonas, mia, server } = await zwei();
    const antwort = await mia.anfrage("/api/v1/verfahrensdoku/angaben", {
      method: "PUT",
      body: { ...ANGABEN, rechtsform: "GmbH", eigene: [] },
    });
    expect(antwort.status).toBe(200);
    expect((await lesen(jonas)).angaben).toEqual(ANGABEN);
    expect((await lesen(mia)).angaben.rechtsform).toBe("GmbH");
    const zeilen = server.sqlite
      .query("SELECT betrieb_id, rechtsform FROM verfahrensdoku_angaben ORDER BY rechtsform")
      .all();
    expect(zeilen).toEqual([
      { betrieb_id: jonas.betriebId, rechtsform: "Einzelunternehmen" },
      { betrieb_id: mia.betriebId, rechtsform: "GmbH" },
    ]);
  });
});
