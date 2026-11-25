import { describe, expect, it } from "vitest";
import { ersatzHolen, kimaiErsatz, WEBER_IN_KIMAI } from "../../kimai-ersatz.ts";
import { kimaiAbrufen } from "./kimai-abruf.ts";

/*
 * The fetch from Kimai (BAULISTE.md S-705) against the stand-in built after Kimai's source
 * (github.com/kimai/kimai 2.73.0, src/API): token, paging with X-Total-Pages, filters, failures.
 */

const INSTANZ = "https://zeit.weber.test";
const ZUGANG = { instanz: INSTANZ, token: "kimai_e2e_4711", benutzer: null };
const ZEITRAUM = { von: "2026-09-01", bis: "2026-09-30" };

const mitErsatz = (optionen: Partial<Parameters<typeof kimaiErsatz>[0]> = {}) => {
  const ersatz = kimaiErsatz({
    token: ZUGANG.token,
    daten: WEBER_IN_KIMAI,
    seitengroesse: 2,
    ...optionen,
  });
  return {
    ersatz,
    deps: { holen: ersatzHolen(ersatz.fetch), erlaubt: new Set<string>() },
  };
};

describe("kimaiAbrufen", () => {
  it("fetches every list, the timesheets page by page, with the token as a bearer", async () => {
    const { ersatz, deps } = mitErsatz();
    const abruf = await kimaiAbrufen(deps, ZUGANG, ZEITRAUM);
    expect(abruf.ok).toBe(true);
    if (!abruf.ok) return;
    expect(abruf.wert.user).toHaveLength(3);
    expect(abruf.wert.customer).toHaveLength(2);
    // the bakery's project ended in September: only ignoreDates=1 lists it
    expect(abruf.wert.project).toHaveLength(2);
    expect(abruf.wert.timesheet.map((t) => (t as { id: number }).id)).toEqual([10, 11, 12, 13, 14]);
    const seiten = ersatz.anfragen.filter((a) => a.pfad === "/api/timesheets");
    expect(seiten.map((a) => a.abfrage.get("page"))).toEqual(["1", "2", "3"]);
    expect(Object.fromEntries(seiten[0]?.abfrage ?? [])).toMatchObject({
      user: "all",
      begin: "2026-08-31T00:00:00",
      end: "2026-10-01T23:59:59",
      size: "500",
      orderBy: "begin",
      order: "ASC",
    });
    expect(ersatz.anfragen.every((a) => a.kopf.authorization === "Bearer kimai_e2e_4711")).toBe(
      true,
    );
    expect(ersatz.anfragen.find((a) => a.pfad === "/api/customers")?.abfrage.get("visible")).toBe(
      "3",
    );
  });

  it("sends the old X-AUTH headers when a user name is given", async () => {
    const { ersatz, deps } = mitErsatz({ altesVerfahren: { benutzer: "jonas" } });
    const abruf = await kimaiAbrufen(deps, { ...ZUGANG, benutzer: "jonas" }, ZEITRAUM);
    expect(abruf.ok).toBe(true);
    expect(ersatz.anfragen[0]?.kopf).toMatchObject({
      "x-auth-user": "jonas",
      "x-auth-token": "kimai_e2e_4711",
    });
    expect(ersatz.anfragen[0]?.kopf.authorization).toBeUndefined();
  });

  it("refuses an address before any request: http, private, with a password", async () => {
    const { ersatz, deps } = mitErsatz();
    for (const instanz of [
      "http://zeit.weber.test",
      "https://10.0.0.7",
      "https://a:b@zeit.weber.test",
    ])
      expect(await kimaiAbrufen(deps, { ...ZUGANG, instanz }, ZEITRAUM)).toEqual({
        ok: false,
        grund: "adresse_ungueltig",
      });
    expect(ersatz.anfragen).toEqual([]);
  });

  it.each([
    [401, { grund: "zugang_abgelehnt" }],
    [403, { grund: "rechte_fehlen" }],
    [429, { grund: "zu_viele_anfragen", wiederholenNach: 60 }],
    [500, { grund: "nicht_erreichbar" }],
    ["weiter", { grund: "weiterleitung" }],
    ["kaputt", { grund: "antwort_ungueltig" }],
  ] as const)("ends the fetch on %s without a retry", async (stoerung, fehler) => {
    const { ersatz, deps } = mitErsatz();
    ersatz.stoeren(stoerung);
    expect(await kimaiAbrufen(deps, ZUGANG, ZEITRAUM)).toEqual({ ok: false, ...fehler });
    expect(ersatz.anfragen).toHaveLength(1);
  });

  it("says when the token may not see everyone, instead of fetching only its own times", async () => {
    const { deps } = mitErsatz({ alleSehen: false });
    expect(await kimaiAbrufen(deps, ZUGANG, ZEITRAUM)).toEqual({
      ok: false,
      grund: "rechte_fehlen",
    });
  });

  it("calls a wrong token refused", async () => {
    const { deps } = mitErsatz();
    expect(await kimaiAbrufen(deps, { ...ZUGANG, token: "falsch" }, ZEITRAUM)).toEqual({
      ok: false,
      grund: "zugang_abgelehnt",
    });
  });

  it("refuses more than 20,000 records", async () => {
    const viele = Array.from({ length: 20_001 }, (_, i) => ({
      id: i + 1,
      user: 2,
      begin: "2026-09-01T07:00:00+0200",
      end: "2026-09-01T08:00:00+0200",
    }));
    const { deps } = mitErsatz({
      daten: { ...WEBER_IN_KIMAI, timesheets: viele },
      seitengroesse: 500,
    });
    expect(await kimaiAbrufen(deps, ZUGANG, ZEITRAUM)).toEqual({ ok: false, grund: "zu_viele" });
  });
});
