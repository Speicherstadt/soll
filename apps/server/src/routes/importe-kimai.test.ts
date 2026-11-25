import { describe, expect, it } from "vitest";
import { kimaiErsatz, WEBER_IN_KIMAI } from "../kimai-ersatz.ts";
import { kettePruefen } from "../modules/audit/index.ts";
import { IMP, weberZumUmzug } from "./importe-testhilfen.ts";
import { anlegen, json, mitProjektzeit } from "./projektzeit-testhilfen.ts";

/*
 * The import from Kimai through the API (BAULISTE.md S-705): the fetch against the stand-in built
 * after Kimai's source (github.com/kimai/kimai 2.73.0, src/API), then preview, dry run and takeover
 * of the file it became; a second fetch creates nothing; the token is in no answer, file or log.
 */

const TOKEN = "kimai_e2e_4711";
const INSTANZ = "https://zeit.weber.test";

const weberMitKimai = async (optionen: Partial<Parameters<typeof kimaiErsatz>[0]> = {}) => {
  const ersatz = kimaiErsatz({
    token: TOKEN,
    daten: WEBER_IN_KIMAI,
    seitengroesse: 2,
    ...optionen,
  });
  const log: string[] = [];
  const w = await weberZumUmzug({ kimaiFetch: ersatz.fetch, log: (zeile) => log.push(zeile) });
  return { ...w, ersatz, log };
};
type W = Awaited<ReturnType<typeof weberMitKimai>>;

const abrufKoerper = (aenderung: Record<string, unknown> = {}) => ({
  quelle: "kimai",
  zugang: { instanz: INSTANZ, token: TOKEN, benutzer: null },
  von: "2026-09-01",
  bis: "2026-09-30",
  ...aenderung,
});

const abrufen = async (w: W) => {
  const antwort = await w.weber.anfrage(`${IMP}/abruf`, { body: abrufKoerper() });
  expect(antwort.status).toBe(200);
  return (await json(antwort)).datei as { name: string; inhalt: string };
};

const uebernahme = (w: W, datei: unknown, taetigkeiten: Record<string, unknown> = {}) => ({
  quelle: "kimai",
  datei,
  spalten: {},
  zuordnung: {
    personen: {
      "Sandra Kühn": w.sandra.nutzerId,
      "Max Brandt": w.max.nutzerId,
      "Jonas Weber": null,
    },
    arten: {},
    kunden: {},
    projekte: {},
    taetigkeiten,
  },
  abgeschlossenBis: null,
});

const zaehlen = (w: W, tabelle: string) =>
  (
    w.server.sqlite
      .query(
        `SELECT count(*) AS n FROM ${tabelle} WHERE betrieb_id = ? AND extern_quelle = 'kimai'`,
      )
      .get(w.weber.betriebId) as { n: number }
  ).n;

describe("the import from Kimai (S-705)", () => {
  it("fetches a file without the token, descriptions or rates, and previews it", async () => {
    const w = await weberMitKimai();
    const datei = await abrufen(w);
    expect(datei.name).toBe("kimai-2026-09-01-2026-09-30.jsonl");
    const text = Buffer.from(datei.inhalt, "base64").toString("utf8");
    for (const verboten of [TOKEN, "Rohre verlegt", "240", "Baustelle", "@weber", "Tor 3"])
      expect(text).not.toContain(verboten);
    const vorschau = await json(
      await w.weber.anfrage(`${IMP}/vorschau`, { body: { quelle: "kimai", datei, spalten: {} } }),
    );
    expect(vorschau.anzahl).toEqual({
      zeiten: 4,
      abwesenheiten: 0,
      kunden: 2,
      projekte: 2,
      taetigkeiten: 2,
      buchungen: 5,
    });
    expect(vorschau.taetigkeiten).toEqual([
      { externalId: "1", name: "Montage" },
      { externalId: "2", name: "Rohinstallation" },
    ]);
    expect((vorschau.personen as { person: string }[]).map((p) => p.person)).toEqual([
      "Max Brandt",
      "Sandra Kühn",
    ]);
    expect(vorschau.lesefehler).toEqual({
      anzahl: 1,
      liste: [{ zeile: 15, grund: "laeuft_noch", feld: "end" }],
    });
  });

  it("takes customers, projects, activities, times and bookings over; a second fetch creates nothing", async () => {
    const w = await weberMitKimai();
    const probe = await json(
      await w.weber.anfrage(`${IMP}/probelauf`, { body: uebernahme(w, await abrufen(w)) }),
    );
    expect(probe.zahlen).toMatchObject({
      kunden: { neu: 2 },
      projekte: { neu: 2 },
      taetigkeiten: { neu: 2 },
      zeiten: { neu: 4, abgelehnt: 0 },
      buchungen: { neu: 5, abgelehnt: 0 },
    });
    const erster = await w.weber.anfrage(IMP, { body: uebernahme(w, await abrufen(w)) });
    expect(erster.status).toBe(201);
    expect(zaehlen(w, "projektzeiten")).toBe(5);
    expect(zaehlen(w, "taetigkeiten")).toBe(2);
    const importId = (await json(erster)).importId;
    const taetigkeit = w.server.sqlite
      .query(
        "SELECT import_id AS importId, abrechenbar FROM taetigkeiten WHERE betrieb_id = ? AND extern_id = '2'",
      )
      .get(w.weber.betriebId);
    expect(taetigkeit).toEqual({ importId, abrechenbar: 0 });

    const zweiter = await json(
      await w.weber.anfrage(IMP, { body: uebernahme(w, await abrufen(w)) }),
    );
    expect(zweiter.zahlen).toMatchObject({
      kunden: { neu: 0, vorhanden: 2 },
      projekte: { neu: 0, vorhanden: 2 },
      taetigkeiten: { neu: 0, vorhanden: 2 },
      zeiten: { neu: 0, vorhanden: 4 },
      buchungen: { neu: 0, vorhanden: 5 },
    });
    expect(zaehlen(w, "projektzeiten")).toBe(5);
    expect(kettePruefen(w.server.db, w.weber.betriebId)).toEqual([]);
    expect(w.log.join("\n")).not.toContain(TOKEN);
  });

  it("books on an activity of the business the owner chose, and leaves one out", async () => {
    const w = await weberMitKimai();
    const eigene = await anlegen(w.weber, "/taetigkeiten", { name: "Montage" });
    const ergebnis = await json(
      await w.weber.anfrage(IMP, {
        body: uebernahme(w, await abrufen(w), { "1": { id: eigene.taetigkeitId }, "2": "aus" }),
      }),
    );
    expect(ergebnis.zahlen).toMatchObject({
      taetigkeiten: { neu: 0, vorhanden: 1, ausgelassen: 1 },
      buchungen: { neu: 4, ausgelassen: 1 },
    });
    const aufEigene = w.server.sqlite
      .query("SELECT count(*) AS n FROM projektzeiten WHERE betrieb_id = ? AND taetigkeit_id = ?")
      .get(w.weber.betriebId, eigene.taetigkeitId as string) as { n: number };
    expect(aufEigene.n).toBe(4);
  });

  it("refuses an activity of another business in the mapping", async () => {
    const w = await weberMitKimai();
    const mia = await mitProjektzeit(w.server, "Café Elbblick", "elbblick");
    const fremd = await anlegen(mia, "/taetigkeiten", { name: "Service" });
    const datei = await abrufen(w);
    for (const pfad of [IMP, `${IMP}/probelauf`]) {
      const antwort = await w.weber.anfrage(pfad, {
        body: uebernahme(w, datei, { "1": { id: fremd.taetigkeitId } }),
      });
      expect(antwort.status).toBe(422);
      expect(await json(antwort)).toEqual({ fehler: "taetigkeit_unbekannt" });
    }
  });

  it("answers failures as values, without the token", async () => {
    const w = await weberMitKimai({ alleSehen: false });
    const faelle: [Record<string, unknown>, number, string][] = [
      [{}, 422, "rechte_fehlen"],
      [{ zugang: { instanz: INSTANZ, token: "falsch", benutzer: null } }, 422, "zugang_abgelehnt"],
      [
        { zugang: { instanz: "http://zeit.weber.test", token: TOKEN, benutzer: null } },
        422,
        "adresse_ungueltig",
      ],
      [
        { zugang: { instanz: "https://169.254.169.254", token: TOKEN, benutzer: null } },
        422,
        "adresse_ungueltig",
      ],
      // what node:http cannot send as a header value (review S-705): an error value, not a 500
      [{ zugang: { instanz: INSTANZ, token: TOKEN, benutzer: "Łukasz" } }, 422, "zugang_ungueltig"],
      [
        { zugang: { instanz: INSTANZ, token: `kimai\n${TOKEN}`, benutzer: null } },
        422,
        "zugang_ungueltig",
      ],
      [{ von: "2026-11-01", bis: "2026-12-31" }, 422, "zeitraum"],
      [{ von: "2025-01-01", bis: "2026-09-30" }, 422, "zeitraum"],
    ];
    for (const [aenderung, status, fehler] of faelle) {
      const antwort = await w.weber.anfrage(`${IMP}/abruf`, { body: abrufKoerper(aenderung) });
      expect(antwort.status).toBe(status);
      const text = await antwort.text();
      expect(JSON.parse(text)).toEqual({ fehler });
      expect(text).not.toContain(TOKEN);
    }
    w.ersatz.stoeren(429);
    const viele = await w.weber.anfrage(`${IMP}/abruf`, { body: abrufKoerper() });
    expect(viele.status).toBe(429);
    expect(await json(viele)).toEqual({ fehler: "zu_viele_anfragen", wiederholenNach: 60 });
    expect(w.log.join("\n")).not.toContain(TOKEN);
  });

  it("drops a line break pasted with the token", async () => {
    const w = await weberMitKimai();
    const zugang = { instanz: INSTANZ, token: `${TOKEN}\n`, benutzer: null };
    const antwort = await w.weber.anfrage(`${IMP}/abruf`, { body: abrufKoerper({ zugang }) });
    expect(antwort.status).toBe(200);
  });

  it("lets only the owner fetch", async () => {
    const w = await weberMitKimai();
    for (const person of [w.sandra, w.anna])
      expect((await person.anfrage(`${IMP}/abruf`, { body: abrufKoerper() })).status).toBe(403);
    expect(w.ersatz.anfragen).toEqual([]);
    const falsch = await w.weber.anfrage(`${IMP}/abruf`, { body: { ...abrufKoerper(), extra: 1 } });
    expect(falsch.status).toBe(400);
  });
});
