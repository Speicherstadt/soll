import { describe, expect, it } from "vitest";
import { MODULE, type Modul } from "../modules/betrieb/index.ts";
import { testServer } from "../test-server.ts";

/**
 * A switched-off module is missing from the API (BAULISTE.md S-603): every route the app registers
 * is read from the app itself, so a route added later is covered without being listed here.
 */

type Route = { method: string; path: string };

/** Routes of /api/v1 outside the module groups, each named on purpose: they serve every business */
const OHNE_MODUL: readonly string[] = [
  "GET /api/v1/betrieb",
  "PATCH /api/v1/betrieb/module",
  "DELETE /api/v1/betrieb/hinweis",
  // the settings of the checks and what the rules need of a person hold for every rule of the
  // business, in the plan and in the working time alike (S-502)
  "GET /api/v1/betrieb/pruefung",
  "PUT /api/v1/betrieb/pruefung",
  "GET /api/v1/personen/:nutzerId/angaben",
  "PUT /api/v1/personen/:nutzerId/angaben",
  "PUT /api/v1/einrichtung/betrieb",
  "POST /api/v1/einrichtung/abschliessen",
  "GET /api/v1/standorte",
  "POST /api/v1/standorte",
  "DELETE /api/v1/standorte/:standortId",
  "POST /api/v1/einladungen",
  "POST /api/v1/einladungen/liste",
  // a person's own tokens for the API serve every module (S-607)
  "GET /api/v1/zugaenge",
  "POST /api/v1/zugaenge",
  "DELETE /api/v1/zugaenge/:zugangId",
  // an import serves several modules and refuses per record what a switched-off one would hold (S-701)
  "GET /api/v1/importe",
  "POST /api/v1/importe",
  "POST /api/v1/importe/vorschau",
  "POST /api/v1/importe/probelauf",
  "POST /api/v1/importe/abruf",
  "GET /api/v1/importe/:importId/datei",
  "GET /api/v1/importe/vorlagen/:datei",
  // the right of access holds whatever the business switched (docs/plan.md, "Auskunft nach Art. 15")
  "GET /api/v1/auskunft",
  // the Verfahrensdokumentation describes whatever the business switched on, a freelancer's too
  // (docs/plan.md, "Verfahrensdokumentation: Angaben", S-902)
  "GET /api/v1/verfahrensdoku",
  "GET /api/v1/verfahrensdoku/datei",
  "PUT /api/v1/verfahrensdoku/angaben",
  // public: an invitation and the check page of a Prüfwert (docs/plan.md, "Prüfseite")
  "GET /api/v1/einladung/:token",
  "POST /api/v1/einladung/:token/annehmen",
  "POST /api/v1/pruefen",
  // the calendar feed with its secret token instead of a session, refused with its business's
  // module Dienstplan by the feed itself (dienstplan-kalender.test.ts, S-503)
  "GET /api/v1/ics/:datei",
  // public: the description of the API (S-607)
  "GET /api/v1/openapi.json",
  // the tablet's own API: a device token instead of a session, refused with its business's module
  // Terminal by kiosk.ts itself (terminal-kopplung.test.ts, "the module Terminal switched off")
  "POST /api/v1/kiosk/koppeln",
  "GET /api/v1/kiosk",
  "POST /api/v1/kiosk/erkennen",
  "POST /api/v1/kiosk/stempeln",
  "PUT /api/v1/kiosk/schluessel",
  "POST /api/v1/kiosk/offline",
];

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

/** The module a path belongs to: its first segment below /api/v1, if that names a module */
const modulVon = (pfad: string): Modul | undefined => {
  const segment = pfad.split("/")[3] as Modul;
  return MODULE.includes(segment) ? segment : undefined;
};

/** The routes of /api/v1 with a method (Hono lists middleware as "ALL", which answers nothing) */
const routenVon = (server: ReturnType<typeof testServer>): Route[] => {
  const gesehen = new Set<string>();
  return server.app.routes
    .filter((r) => r.method !== "ALL" && r.path.startsWith("/api/v1/"))
    .filter((r) => {
      const name = `${r.method} ${r.path}`;
      if (gesehen.has(name)) return false;
      gesehen.add(name);
      return true;
    })
    .map(({ method, path }) => ({ method, path }));
};

/** A path with its parameters filled in: the module is refused before any id is looked at */
const ausgefuellt = (pfad: string): string => pfad.replace(/:[A-Za-z]+/g, "x");

describe("a switched-off module", () => {
  it("has every route of /api/v1 either in a module group or named as serving every business", () => {
    const server = testServer();
    const lose = routenVon(server)
      .filter((r) => modulVon(r.path) === undefined)
      .map((r) => `${r.method} ${r.path}`)
      .filter((name) => !OHNE_MODUL.includes(name));
    expect(lose).toEqual([]);
  });

  for (const name of MODULE) {
    it(`answers every route of ${name} with 403 modul_aus while it is off`, async () => {
      const server = testServer();
      const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
      const aus = await weber.anfrage("/api/v1/betrieb/module", {
        method: "PATCH",
        body: { [name]: false },
      });
      expect(aus.status).toBe(200);
      const routen = routenVon(server).filter((r) => modulVon(r.path) === name);
      expect(routen.length).toBeGreaterThan(name === "terminal" ? 1 : 2);
      for (const { method, path } of routen) {
        const antwort = await weber.anfrage(ausgefuellt(path), {
          method,
          ...(method === "GET" ? {} : { body: {} }),
        });
        expect(antwort.status, `${method} ${path}`).toBe(403);
        expect(await json(antwort), `${method} ${path}`).toEqual({
          fehler: "modul_aus",
          modul: name,
        });
      }
    });

    it(`lets the routes of ${name} through while it is on`, async () => {
      const server = testServer();
      const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
      await weber.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { [name]: true } });
      for (const { method, path } of routenVon(server).filter((r) => modulVon(r.path) === name)) {
        const antwort = await weber.anfrage(ausgefuellt(path), {
          method,
          ...(method === "GET" ? {} : { body: {} }),
        });
        const fehler = antwort.headers.get("content-type")?.includes("json")
          ? (await json(antwort)).fehler
          : undefined;
        expect(fehler, `${method} ${path}`).not.toBe("modul_aus");
      }
    });
  }
});
