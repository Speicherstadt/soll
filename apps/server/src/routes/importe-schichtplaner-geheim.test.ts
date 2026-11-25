import { ELBBLICK } from "@soll/import/fixtures";
import { describe, expect, it } from "vitest";
import { papershiftErsatz } from "../papershift-ersatz.ts";
import type { Stoerung } from "../schichtplaner-ersatz.ts";
import { testServer } from "../test-server.ts";
import { elbblick, json } from "./dienstplan-testhilfen.ts";
import { IMP, JETZT } from "./importe-testhilfen.ts";

/*
 * Papershift wants its API key in the address (`api_token`, BAULISTE.md S-706). Whatever happens to
 * a fetch, success or failure, the key reaches no log line, no answer, no stored file and no row of
 * the database, the audit chain and `importe` included: the outgoing address is never logged, an
 * error names its reason only, and the file holds only the records.
 */

const TOKEN = "ps-geheimer-schluessel-0815";

const elbblickMitPapershift = async () => {
  const ersatz = papershiftErsatz({ token: TOKEN, daten: ELBBLICK.papershift });
  const log: string[] = [];
  const server = testServer({ log: (zeile) => log.push(zeile), schichtplanerFetch: ersatz.fetch });
  const e = await elbblick(server);
  server.stelleUhr(JETZT);
  return { ...e, ersatz, log };
};

const abruf = (token = TOKEN) => ({
  quelle: "papershift",
  zugang: { token },
  von: "2026-09-01",
  bis: "2026-09-30",
});

/** Every value of every table, as text */
const datenbank = (sqlite: { query: (sql: string) => { all: () => unknown[] } }) =>
  (sqlite.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
    .map(({ name }) => JSON.stringify(sqlite.query(`SELECT * FROM "${name}"`).all()))
    .join("\n");

describe("Papershift's api_token (S-706)", () => {
  it("goes in the address to Papershift and nowhere else, after a takeover too", async () => {
    const e = await elbblickMitPapershift();
    const antwort = await e.mia.anfrage(`${IMP}/abruf`, { body: abruf() });
    const text = await antwort.text();
    expect(antwort.status).toBe(200);
    expect(e.ersatz.anfragen.every((url) => url.searchParams.get("api_token") === TOKEN)).toBe(
      true,
    );
    const datei = (JSON.parse(text) as { datei: { name: string; inhalt: string } }).datei;
    const uebernahme = await e.mia.anfrage(IMP, {
      body: {
        quelle: "papershift",
        datei,
        spalten: {},
        zuordnung: { personen: {}, arten: {}, kunden: {}, projekte: {}, taetigkeiten: {} },
        abgeschlossenBis: null,
      },
    });
    expect(uebernahme.status).toBe(201);
    const importId = (await json(uebernahme)).importId as string;
    const gespeichert = await e.mia.anfrage(`${IMP}/${importId}/datei`);
    expect(gespeichert.status).toBe(200);
    for (const ort of [
      text,
      Buffer.from(datei.inhalt, "base64").toString("utf8"),
      await gespeichert.text(),
      e.log.join("\n"),
      datenbank(e.server.sqlite),
    ])
      expect(ort).not.toContain(TOKEN);
  });

  it("stays out of every answer and log line when the fetch fails", async () => {
    const e = await elbblickMitPapershift();
    const stoerungen: (Stoerung | null)[] = [401, 403, 429, 500, "weiter", "kaputt"];
    for (const stoerung of stoerungen) {
      e.ersatz.stoeren(stoerung);
      const antwort = await e.mia.anfrage(`${IMP}/abruf`, { body: abruf() });
      expect(antwort.status).toBeGreaterThanOrEqual(400);
      expect(await antwort.text()).not.toContain(TOKEN);
    }
    e.ersatz.stoeren(null);
    // a wrong key: refused, and the key typed is in no answer either
    const falsch = await e.mia.anfrage(`${IMP}/abruf`, { body: abruf(`${TOKEN}-falsch`) });
    expect(await falsch.text()).toBe('{"fehler":"zugang_abgelehnt"}');
    expect(e.log.join("\n")).not.toContain(TOKEN);
    expect(datenbank(e.server.sqlite)).not.toContain(TOKEN);
  });
});
