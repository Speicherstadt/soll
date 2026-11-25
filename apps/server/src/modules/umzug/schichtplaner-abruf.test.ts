import { schichtplanerAbzugText, schichtplanerLesen } from "@soll/import";
import { ELBBLICK } from "@soll/import/fixtures";
import { describe, expect, it } from "vitest";
import { crewmeisterErsatz } from "../../crewmeister-ersatz.ts";
import { ersatzHolen } from "../../kimai-ersatz.ts";
import { papershiftErsatz } from "../../papershift-ersatz.ts";
import { plandayErsatz } from "../../planday-ersatz.ts";
import { crewmeisterAbrufen } from "./crewmeister-abruf.ts";
import { papershiftAbrufen } from "./papershift-abruf.ts";
import { plandayAbrufen } from "./planday-abruf.ts";
import type { SchichtplanerDeps } from "./schichtplaner-abruf.ts";

/*
 * The fetches from the shift planners against their stand-ins (BAULISTE.md S-706), which serve
 * the fixtures of packages/import as each tool's sources describe its API; pages of two records,
 * so paging is exercised.
 */

const ZEITRAUM = { von: "2026-09-01", bis: "2026-10-31", heute: "2026-11-25" };
const ADRESSEN = {
  papershift: "https://papershift.test/public_api/v1",
  planday: "https://planday.test",
  plandayId: "https://planday.test",
  crewmeister: "https://crewmeister.test",
};
const deps = (ersatz: {
  fetch: (a: Request) => Response | Promise<Response>;
}): SchichtplanerDeps => ({
  holen: ersatzHolen(ersatz.fetch),
  adressen: ADRESSEN,
});

const gelesen = (werkzeug: string, abzug: Parameters<typeof schichtplanerAbzugText>[0]) =>
  schichtplanerLesen(werkzeug)(new TextEncoder().encode(schichtplanerAbzugText(abzug)));

const papershift = () =>
  papershiftErsatz({ token: "ps-geheim-4711", daten: ELBBLICK.papershift, seitengroesse: 2 });
const planday = () =>
  plandayErsatz({
    appId: "app-17",
    token: "pd-refresh-geheim",
    daten: { ...ELBBLICK.planday, deactivated: [] },
    seitengroesse: 2,
  });
const crewmeister = () =>
  crewmeisterErsatz({
    email: "mia@elbblick.test",
    passwort: "cm-geheim",
    daten: ELBBLICK.crewmeister,
    seitengroesse: 2,
  });

describe("the fetch from Papershift", () => {
  it("reads every page with the token and the language; the file holds no token", async () => {
    const ersatz = papershift();
    const abruf = await papershiftAbrufen(deps(ersatz), { token: "ps-geheim-4711" }, ZEITRAUM);
    if (!abruf.ok) throw new Error(abruf.grund);
    const text = schichtplanerAbzugText(abruf.wert);
    expect(text).not.toContain("ps-geheim");
    const daten = gelesen("papershift", abruf.wert).daten;
    expect(daten.zeiten).toHaveLength(4);
    expect(daten.abwesenheiten).toHaveLength(2);
    expect(
      ersatz.anfragen.every((url) => url.searchParams.get("interface_language") === "de"),
    ).toBe(true);
    // three users on pages of two
    expect(ersatz.anfragen.filter((url) => url.pathname.endsWith("/users"))).toHaveLength(2);
  });

  it("names a refused token and a failure by their reason, never with the address", async () => {
    const falsch = await papershiftAbrufen(deps(papershift()), { token: "x" }, ZEITRAUM);
    expect(falsch).toEqual({ ok: false, grund: "zugang_abgelehnt" });
    for (const [stoerung, grund] of [
      [429, "zu_viele_anfragen"],
      [500, "nicht_erreichbar"],
      ["weiter", "weiterleitung"],
      ["kaputt", "antwort_ungueltig"],
    ] as const) {
      const ersatz = papershift();
      ersatz.stoeren(stoerung);
      const abruf = await papershiftAbrufen(deps(ersatz), { token: "ps-geheim-4711" }, ZEITRAUM);
      expect(abruf).toMatchObject({ ok: false, grund });
      expect(JSON.stringify(abruf)).not.toContain("ps-geheim");
    }
  });
});

describe("the fetch from Planday", () => {
  it("swaps the app's token for an access token and reads lists, pages and breaks", async () => {
    const ersatz = planday();
    const zugang = { appId: "app-17", token: "pd-refresh-geheim" };
    const abruf = await plandayAbrufen(deps(ersatz), zugang, ZEITRAUM);
    if (!abruf.ok) throw new Error(abruf.grund);
    expect(schichtplanerAbzugText(abruf.wert)).not.toContain("pd-");
    const daten = gelesen("planday", abruf.wert).daten;
    expect(daten.zeiten.map((z) => z.externalId)).toEqual(["5001", "5001/2"]);
    expect(daten.schichten).toHaveLength(3);
    expect(daten.abwesenheiten).toHaveLength(2);
    expect(ersatz.anfragen.some((url) => url.pathname.endsWith("/5001/breaks"))).toBe(true);
    // the punch clock only until today, shifts for the whole period
    const stempel = ersatz.anfragen.find((url) => url.pathname.endsWith("/punchclockshifts"));
    expect(stempel?.searchParams.get("to")).toBe("2026-10-31");
  });

  it("names a refused token as such", async () => {
    const abruf = await plandayAbrufen(
      deps(planday()),
      { appId: "app-17", token: "falsch" },
      ZEITRAUM,
    );
    expect(abruf).toEqual({ ok: false, grund: "zugang_abgelehnt" });
  });
});

describe("the fetch from Crewmeister", () => {
  it("logs in with e-mail and password and reads every list page by page", async () => {
    const ersatz = crewmeister();
    const abruf = await crewmeisterAbrufen(
      deps(ersatz),
      { email: "mia@elbblick.test", passwort: "cm-geheim" },
      { ...ZEITRAUM, bis: "2026-09-30" },
    );
    if (!abruf.ok) throw new Error(abruf.grund);
    const text = schichtplanerAbzugText(abruf.wert);
    expect(text).not.toContain("cm-geheim");
    expect(text).not.toContain("cm.");
    const daten = gelesen("crewmeister", abruf.wert).daten;
    expect(daten.zeiten).toHaveLength(4);
    expect(daten.schichten).toHaveLength(3);
    expect(daten.abwesenheiten).toHaveLength(3);
    const schichten = ersatz.anfragen.find((a) => a.pfad.endsWith("/shifts"));
    expect(schichten?.abfrage.get("filter")).toBe(
      "from=ge=2026-08-31T22:00:00.000Z;from=lt=2026-09-30T22:00:00.000Z",
    );
  });

  it("names a wrong password as refused access", async () => {
    const abruf = await crewmeisterAbrufen(
      deps(crewmeister()),
      { email: "mia@elbblick.test", passwort: "falsch" },
      ZEITRAUM,
    );
    expect(abruf).toEqual({ ok: false, grund: "zugang_abgelehnt" });
  });
});
