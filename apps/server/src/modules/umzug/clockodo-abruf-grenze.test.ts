import { abzugText, clockodoLesen } from "@soll/import";
import { describe, expect, it } from "vitest";
import { clockodoAbrufen } from "./clockodo-abruf.ts";

/*
 * Review S-703: BAULISTE.md names "zu viele Datensätze (über 20.000)" as an answer of the fetch.
 * The limit is checked per list, so 19,000 entries and 2,000 absences pass the fetch and give a
 * file the reader refuses whole (`zu_viele`, abzug-lesen.ts) after the owner waited for it.
 */
const antwort = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("the key on its way to Clockodo", () => {
  it("never follows a redirect, so it reaches no other host", async () => {
    const optionen: RequestInit[] = [];
    const fetch = async (_url: string, init: RequestInit) => {
      optionen.push(init);
      return antwort({ paging: { count_pages: 1 }, data: [], entries: [] });
    };
    await clockodoAbrufen(
      { fetch, basis: "https://ersatz.test/api" },
      { nutzer: "a@b.test", schluessel: "k" },
      { von: "2026-01-01", bis: "2026-01-31" },
    );
    expect(optionen.length).toBe(6);
    for (const init of optionen) expect(init.redirect).toBe("error");
  });
});

describe("the limit of 20,000 records over one fetch", () => {
  it("does not answer with a file that the reader refuses as too many", async () => {
    const eintraege = Array.from({ length: 19_000 }, (_, i) => ({
      id: i + 1,
      users_id: 1,
      type: 1,
      time_since: "2026-03-02T07:00:00Z",
      time_until: "2026-03-02T07:01:00Z",
    }));
    const abwesenheiten = Array.from({ length: 2_000 }, (_, i) => ({
      id: i + 1,
      users_id: 1,
      date_since: "2026-03-03",
      date_until: "2026-03-03",
      status: 1,
      type: 1,
      count_days: 1,
      count_hours: null,
    }));
    const fetch = async (url: string) => {
      const pfad = new URL(url).pathname;
      if (pfad.endsWith("/v2/entries"))
        return antwort({ paging: { count_pages: 1 }, entries: eintraege });
      if (pfad.endsWith("/v4/absences")) return antwort({ data: abwesenheiten });
      return antwort({ paging: { count_pages: 1 }, data: [{ id: 1, name: "A" }] });
    };
    const abruf = await clockodoAbrufen(
      { fetch, basis: "https://ersatz.test/api" },
      { nutzer: "a@b.test", schluessel: "k" },
      { von: "2026-01-01", bis: "2026-06-30" },
    );
    if (!abruf.ok) {
      expect(abruf.grund).toBe("zu_viele");
      return;
    }
    const gelesen = clockodoLesen(abzugText(abruf.wert));
    expect(gelesen.fehler.filter((f) => f.grund === "zu_viele")).toEqual([]);
  });
});
