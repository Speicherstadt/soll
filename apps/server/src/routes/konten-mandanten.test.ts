import { describe, expect, it } from "vitest";
import { angelegt, genehmigt, krank, weberMitAbwesenheiten } from "./abwesenheit-testhilfen.ts";
import { anpassen, hinweis, type Json, json, KONTEN, konten } from "./konten-testhilfen.ts";

const TEAM = "/api/v1/arbeitszeit/abwesenheiten/team";

/** Weber with Sandra's notice and a change by hand, and Café Elbblick with Mia and Tom */
const zwei = async () => {
  const w = await weberMitAbwesenheiten();
  expect((await hinweis(w.jonas, w.sandra, "2026-11-20")).status).toBe(201);
  expect(
    (await anpassen(w.jonas, w.sandra, { art: "startsaldo", monat: "2026-10", minuten: 60 }))
      .status,
  ).toBe(201);
  const mia = await w.server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  const tom = await w.server.eingeladen(mia, "mitarbeiter", "tom");
  return { ...w, mia, tom };
};

const zeilen = (server: Awaited<ReturnType<typeof zwei>>["server"]) => ({
  anpassungen: server.sqlite.query("SELECT * FROM konto_anpassungen").all(),
  hinweise: server.sqlite.query("SELECT * FROM urlaubshinweise").all(),
});

describe("no business sees or changes another's accounts", () => {
  it(`GET ${KONTEN} shows no person of another business`, async () => {
    const { mia, tom, sandra } = await zwei();
    expect((await mia.anfrage(`${KONTEN}?nutzerId=${sandra.nutzerId}`)).status).toBe(404);
    const eigen = await konten(tom);
    expect(eigen).toMatchObject({ nutzerId: tom.nutzerId, hinweise: [], anpassungen: [] });
  });

  it(`POST ${KONTEN}/:nutzerId/hinweise finds no person of another business`, async () => {
    const { mia, sandra, server } = await zwei();
    const vorher = zeilen(server);
    const antwort = await hinweis(mia, sandra, "2026-11-19");
    expect(antwort.status).toBe(404);
    expect(await json(antwort)).toEqual({ fehler: "unbekannt" });
    expect(zeilen(server)).toEqual(vorher);
  });

  it(`POST ${KONTEN}/:nutzerId/anpassungen finds no person of another business`, async () => {
    const { mia, sandra, server } = await zwei();
    const vorher = zeilen(server);
    const antwort = await anpassen(mia, sandra, {
      art: "korrektur",
      monat: "2026-11",
      minuten: 60,
    });
    expect(antwort.status).toBe(404);
    expect(zeilen(server)).toEqual(vorher);
  });

  it("writes into one's own business only", async () => {
    const { mia, tom, server } = await zwei();
    const vorher = zeilen(server);
    expect(
      (await anpassen(mia, tom, { art: "korrektur", monat: "2026-11", minuten: 60 })).status,
    ).toBe(201);
    const neu = zeilen(server).anpassungen.slice(vorher.anpassungen.length) as Json[];
    expect(neu.map((z) => z.betrieb_id)).toEqual([mia.betriebId]);
  });

  it(`GET ${TEAM} takes no site of another business`, async () => {
    const { mia, jonas } = await zwei();
    await mia.anfrage("/api/v1/standorte", { body: { name: "Café", land: "HH" } });
    const [cafe] = (await json(await mia.anfrage("/api/v1/standorte"))).standorte as Json[];
    const antwort = await jonas.anfrage(
      `${TEAM}?von=2026-12-01&bis=2026-12-31&standortId=${cafe?.standortId}`,
    );
    expect(antwort.status).toBe(404);
    expect(await json(antwort)).toEqual({ fehler: "standort_unbekannt" });
  });
});

describe("the team calendar of a site", () => {
  it("shows the holidays of the site and everyone away only as „abwesend“, with no count per person", async () => {
    const w = await weberMitAbwesenheiten();
    await genehmigt(w, w.sandra, { von: "2026-12-21", bis: "2026-12-23" });
    await angelegt(krank(w.max, { art: "krank", bis: "2026-11-24" }));
    const [werkstatt] = (await json(await w.jonas.anfrage("/api/v1/standorte")))
      .standorte as Json[];
    for (const wer of [w.jonas, w.anna, w.sandra, w.max]) {
      const team = await json(
        await wer.anfrage(
          `${TEAM}?von=2026-11-20&bis=2026-12-31&standortId=${werkstatt?.standortId}`,
        ),
      );
      expect(team.standortId).toBe(werkstatt?.standortId);
      expect(team.feiertage).toEqual([
        { tag: "2026-12-25", name: "1. Weihnachtstag" },
        { tag: "2026-12-26", name: "2. Weihnachtstag" },
      ]);
      const eintraege = team.abwesenheiten as Json[];
      expect(eintraege.map((e) => [e.name, e.art])).toEqual([
        ["max", "abwesend"],
        ["sandra", "abwesend"],
      ]);
      // nothing per person beyond the span: no days, no share, no ranking (BetrVG § 87)
      for (const e of eintraege)
        expect(Object.keys(e).sort()).toEqual(
          [
            "abwesenheitId",
            "art",
            "bis",
            "ersterHalb",
            "letzterHalb",
            "name",
            "nutzerId",
            "von",
            ...("stornierbar" in e ? ["stornierbar"] : []),
          ].sort(),
        );
      expect(Object.keys(team).sort()).toEqual(
        ["abwesenheiten", "bis", "feiertage", "standortId", "von"].sort(),
      );
    }
  });

  it("without a site asked for, has the holidays of the first site, else of the business's Land", async () => {
    const { jonas, server } = await weberMitAbwesenheiten();
    const team = await json(await jonas.anfrage(`${TEAM}?von=2026-12-20&bis=2026-12-31`));
    expect(team).toMatchObject({ standortId: null });
    expect((team.feiertage as Json[]).map((f) => f.tag)).toEqual(["2026-12-25", "2026-12-26"]);
    // a business with neither: no holidays rather than guessed ones
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    const ohne = await json(await mia.anfrage(`${TEAM}?von=2026-12-20&bis=2026-12-31`));
    expect(ohne).toMatchObject({ standortId: null, feiertage: [] });
  });
});

describe("the module working time switched off", () => {
  it("refuses every route of the accounts", async () => {
    const { server } = await zwei();
    const allein = await server.inhaberMitBetrieb("Mia allein", "mia-allein");
    expect(
      (
        await allein.anfrage("/api/v1/betrieb/module", {
          method: "PATCH",
          body: { arbeitszeit: false },
        })
      ).status,
    ).toBe(200);
    for (const [pfad, body] of [
      [KONTEN, undefined],
      [`${KONTEN}/${allein.nutzerId}/hinweise`, { tag: "2026-11-20" }],
      [
        `${KONTEN}/${allein.nutzerId}/anpassungen`,
        { art: "korrektur", monat: "2026-11", minuten: 1, grund: "x" },
      ],
    ] as const) {
      const antwort = await allein.anfrage(pfad, body === undefined ? {} : { body });
      expect(antwort.status, pfad).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "modul_aus", modul: "arbeitszeit" });
    }
  });
});
