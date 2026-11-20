import { describe, expect, it } from "vitest";
import {
  angelegt,
  antrag,
  genehmigt,
  type Json,
  json,
  krank,
  liste,
  offen,
  schritt,
  um,
  weberMitAbwesenheiten,
} from "./abwesenheit-testhilfen.ts";

const BASIS = "/api/v1/arbeitszeit/abwesenheiten";

/** Weber with Sandra's request, her sickness and an approved leave, and Café Elbblick */
const zwei = async () => {
  const w = await weberMitAbwesenheiten();
  const antragId = await angelegt(
    antrag(w.sandra, { art: "urlaub", von: "2026-12-21", bis: "2026-12-22" }),
  );
  const urlaubId = await genehmigt(w, w.sandra, { von: "2026-12-28", bis: "2026-12-29" });
  const krankId = await angelegt(krank(w.sandra));
  w.server.stelleUhr(um("2026-11-24T09:00:00+01:00"));
  const mia = await w.server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  const tom = await w.server.eingeladen(mia, "mitarbeiter", "tom");
  return { ...w, mia, tom, antragId, urlaubId, krankId };
};

const zeilen = (server: Awaited<ReturnType<typeof zwei>>["server"]) =>
  server.sqlite.query("SELECT * FROM abwesenheiten ORDER BY rowid").all();

describe("no business sees or changes another's absences", () => {
  it(`GET ${BASIS} shows no person of another business`, async () => {
    const { mia, sandra } = await zwei();
    expect((await mia.anfrage(`${BASIS}?nutzerId=${sandra.nutzerId}`)).status).toBe(404);
    expect((await liste(mia)).abwesenheiten).toEqual([]);
  });

  it(`GET ${BASIS}/offen lists only one's own business`, async () => {
    const { mia } = await zwei();
    expect(await offen(mia)).toEqual({ antraege: [], erinnerungen: [] });
  });

  it(`GET ${BASIS}/team lists only one's own business`, async () => {
    const { mia, tom, jonas } = await zwei();
    await angelegt(krank(tom));
    const team = async (wer: typeof mia) =>
      (
        (await json(await wer.anfrage(`${BASIS}/team?von=2026-11-01&bis=2026-12-31`)))
          .abwesenheiten as Json[]
      ).map((a) => a.name);
    expect(await team(mia)).toEqual(["tom"]);
    expect(await team(jonas)).toEqual(["sandra", "sandra"]);
  });

  it(`POST ${BASIS}/antrag and /krank write into one's own business only`, async () => {
    const { tom, mia, server } = await zwei();
    const vorher = zeilen(server).length;
    await angelegt(antrag(tom, { art: "urlaub", von: "2026-12-21", bis: "2026-12-22" }));
    await angelegt(krank(tom));
    const neu = zeilen(server).slice(vorher) as { betrieb_id: string }[];
    expect(neu.map((z) => z.betrieb_id)).toEqual([mia.betriebId, mia.betriebId]);
  });

  for (const [aktion, body] of [
    ["freigeben", {}],
    ["ablehnen", { grund: "nein" }],
    ["zurueckziehen", {}],
    ["stornieren", { grund: "nein" }],
    ["bescheinigung", { bescheinigung: "eau" }],
    ["beenden", { bis: "2026-11-30" }],
  ] as const) {
    it(`POST ${BASIS}/:id/${aktion} finds no absence of another business`, async () => {
      const { mia, server, antragId, urlaubId, krankId } = await zwei();
      const vorher = zeilen(server);
      for (const id of [antragId, urlaubId, krankId]) {
        const antwort = await schritt(mia, id, aktion, body);
        expect(antwort.status).toBe(404);
        expect(await json(antwort)).toEqual({ fehler: "unbekannt" });
      }
      expect(zeilen(server)).toEqual(vorher);
    });
  }

  it(`PUT ${BASIS}/einstellungen changes one's own business only`, async () => {
    const { mia, sandra } = await zwei();
    const antwort = await mia.anfrage(`${BASIS}/einstellungen`, {
      method: "PUT",
      body: { bescheinigungAbTag: 1 },
    });
    expect(antwort.status).toBe(200);
    expect((await liste(mia)).bescheinigungAbTag).toBe(1);
    expect((await liste(sandra)).bescheinigungAbTag).toBe(4);
  });
});

describe("the module working time switched off", () => {
  it("refuses every route of absences", async () => {
    const { server } = await zwei();
    // a freelancer without employees may switch working time off (docs/plan.md, "Module")
    const mia = await server.inhaberMitBetrieb("Mia allein", "mia-allein");
    expect(
      (
        await mia.anfrage("/api/v1/betrieb/module", {
          method: "PATCH",
          body: { arbeitszeit: false },
        })
      ).status,
    ).toBe(200);
    for (const [pfad, body] of [
      [BASIS, undefined],
      [`${BASIS}/offen`, undefined],
      [`${BASIS}/team?von=2026-11-01&bis=2026-11-30`, undefined],
      [`${BASIS}/antrag`, { art: "urlaub", von: "2026-12-21", bis: "2026-12-22" }],
      [`${BASIS}/krank`, { art: "krank" }],
      [`${BASIS}/x/freigeben`, {}],
    ] as const) {
      const antwort = await mia.anfrage(pfad, body === undefined ? {} : { body });
      expect(antwort.status, pfad).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "modul_aus", modul: "arbeitszeit" });
    }
  });
});
