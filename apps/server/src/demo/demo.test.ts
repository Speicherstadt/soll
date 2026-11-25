import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { plusTage, wochenbeginn } from "@soll/arbeitszeit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { DEMO_PASSWORT } from "./betriebe.ts";
import { cafeTage } from "./cafe.ts";
import { browser, erwarten } from "./client.ts";
import { type DemoErgebnis, demoAnlegen, demoApp } from "./demo.ts";
import { ereignisseBis } from "./plan.ts";
import { weberTage } from "./weber.ts";
import { zeitraumVon } from "./zeitraum.ts";

// One run of `bun run demo` into a temporary directory (BAULISTE.md S-909), read afterwards as the
// server would open it. 25.11.2026 puts August to October 2026 in the closed months, and the last
// Saturday of October (24.10.) before the night the clocks go back.
const HEUTE = "2026-11-25";
const URL = "http://localhost:8200";
const zeitraum = zeitraumVon(HEUTE);
const schluessel = crypto.getRandomValues(new Uint8Array(32));
const ziel = mkdtempSync(join(tmpdir(), "soll-demo-"));
let ergebnis: Extract<DemoErgebnis, { ok: true }>;
let offen: ReturnType<typeof demoApp>;

type Json = Record<string, unknown>;
type Befund = { regel: string; tage: string[]; nutzerId?: string };

const anmelden = async (email: string, betrieb: string) => {
  const anfrage = browser(offen.holen, URL);
  await erwarten(anfrage, "/api/auth/sign-in/email", { body: { email, password: DEMO_PASSWORT } });
  await erwarten(anfrage, "/api/auth/organization/set-active", {
    body: { organizationId: betriebId(betrieb) },
  });
  return anfrage;
};

const zaehlen = (sql: string, ...werte: string[]) =>
  (offen.sqlite.query(sql).get(...werte) as { n: number }).n;

const nutzer = (benutzername: string) =>
  (offen.sqlite.query("SELECT id FROM user WHERE username = ?").get(benutzername) as { id: string })
    .id;

const betriebId = (name: string) => ergebnis.betriebe.find((b) => b.name === name)?.betriebId ?? "";

beforeAll(async () => {
  const lauf = await demoAnlegen({ ziel, heute: HEUTE, geheimerSchluessel: schluessel, url: URL });
  if (!lauf.ok) throw new Error(lauf.grund);
  ergebnis = lauf;
  offen = demoApp(ziel, { geheimerSchluessel: schluessel, url: URL }, () => zeitraum.ende);
  // three months of two businesses through the HTTP API, about 3,500 requests and 20 passwords with
  // scrypt: tens of seconds on a busy runner, far over the 5 s of a unit test
}, 300_000);

afterAll(() => {
  offen?.schliessen();
  rmSync(ziel, { recursive: true, force: true });
});

describe("bun run demo (S-909)", () => {
  it("sets up both businesses with the people of CLAUDE.md, and both chains verify", () => {
    expect(ergebnis.anmeldungen.map((a) => `${a.betrieb}: ${a.name.split(" ")[0]}`)).toEqual([
      "Weber Haustechnik: Jonas",
      "Weber Haustechnik: Anna",
      "Weber Haustechnik: Sandra",
      "Weber Haustechnik: Max",
      "Weber Haustechnik: Leon",
      "Café Elbblick: Mia",
      "Café Elbblick: Tom",
      "Café Elbblick: Lea",
      "Café Elbblick: Yusuf",
      "Café Elbblick: Olena",
      "Café Elbblick: Piotr",
    ]);
    for (const { betriebId: id, kettenbefunde } of ergebnis.betriebe) {
      expect(kettenbefunde).toBe(0);
      expect(kettePruefen(offen.db, id)).toEqual([]);
    }
    // e-mail only for the owners, under .test; the others were invited by link without one
    expect(zaehlen("SELECT COUNT(*) AS n FROM user WHERE email LIKE '%.test'")).toBe(2);
  });

  it("writes three months of stamps, absences, plans, bookings and closings", () => {
    const weber = betriebId("Weber Haustechnik");
    const cafe = betriebId("Café Elbblick");
    const stempel = "SELECT COUNT(*) AS n FROM stempelungen WHERE betrieb_id = ? AND quelle = ?";
    expect(zaehlen(stempel, weber, "app")).toBeGreaterThan(900);
    expect(zaehlen(stempel, cafe, "terminal")).toBeGreaterThan(900);
    expect(zaehlen("SELECT COUNT(*) AS n FROM abwesenheiten")).toBe(5);
    expect(
      zaehlen("SELECT COUNT(*) AS n FROM abwesenheiten WHERE art = 'kind_krank' AND kind = 'K1'"),
    ).toBe(1);
    expect(
      zaehlen("SELECT COUNT(*) AS n FROM monatsabschluesse WHERE schritt = 'abgeschlossen'"),
    ).toBe(27);
    expect(ergebnis.pruefwerte).toHaveLength(27);
    expect(
      zaehlen("SELECT COUNT(*) AS n FROM schichten WHERE betrieb_id = ?", cafe),
    ).toBeGreaterThan(250);
    expect(
      zaehlen("SELECT COUNT(*) AS n FROM projektzeiten WHERE betrieb_id = ?", weber),
    ).toBeGreaterThan(500);
    expect(zaehlen("SELECT COUNT(*) AS n FROM stundennachweise WHERE betrieb_id = ?", weber)).toBe(
      1,
    );
    expect(zaehlen("SELECT COUNT(*) AS n FROM terminals WHERE betrieb_id = ?", cafe)).toBe(1);
  });

  it("shows a Prüfwert of a closed month as matching on the check page", async () => {
    const [erster] = ergebnis.pruefwerte;
    const antwort = await erwarten<Json>(browser(offen.holen, URL), "/api/v1/pruefen", {
      body: { betriebId: betriebId("Weber Haustechnik"), pruefwert: erster?.pruefwert },
    });
    expect(antwort).toMatchObject({
      ergebnis: "uebereinstimmend",
      monat: zeitraum.volleMonate[0],
      betrieb: "Weber Haustechnik",
    });
  });

  it("has the findings on purpose: §§ 3, 4 and 5 ArbZG in the months, § 8 JArbSchG in the plan", async () => {
    const jonas = await anmelden("jonas@weber-haustechnik.test", "Weber Haustechnik");
    const monat = async (wer: typeof jonas, m: string, person: string) =>
      (
        await erwarten<{ inhalt: { befunde: Befund[] } }>(
          wer,
          `/api/v1/arbeitszeit/monat?monat=${m}&nutzerId=${nutzer(person)}`,
          { method: "GET" },
        )
      ).inhalt.befunde;
    const notdienst = weberTage(zeitraum).notdienst;
    const beiMax = await monat(jonas, zeitraum.volleMonate[1] ?? "", "max");
    // only these on purpose: a normal day stays under 8 hours, so the months show no noise
    expect(beiMax.map((b) => `${b.regel} ${b.tage.join()}`)).toEqual([
      `R-02 ${notdienst}`,
      `R-04 ${notdienst}`,
    ]);

    const mia = await anmelden("mia@cafe-elbblick.test", "Café Elbblick");
    const naechster = plusTage(cafeTage(zeitraum).veranstaltung, 1);
    expect(await monat(mia, zeitraum.volleMonate[1] ?? "", "tom")).toContainEqual(
      expect.objectContaining({ regel: "R-05", tage: expect.arrayContaining([naechster]) }),
    );

    const standortId = (
      offen.sqlite
        .query("SELECT standort_id AS id FROM standorte WHERE betrieb_id = ?")
        .get(betriebId("Weber Haustechnik")) as { id: string }
    ).id;
    const woche = await erwarten<Json>(
      jonas,
      `/api/v1/dienstplan/woche?standortId=${standortId}&tag=${plusTage(wochenbeginn(HEUTE), 7)}`,
      { method: "GET" },
    );
    expect(woche.befunde as Befund[]).toContainEqual(
      expect.objectContaining({ regel: "R-15", nutzerId: nutzer("leon") }),
    );
  });

  it("counts the late shift over the change to winter time in real minutes", async () => {
    const samstag = cafeTage(zeitraum).langeNacht;
    expect(samstag).toBe("2026-10-24");
    const mia = await anmelden("mia@cafe-elbblick.test", "Café Elbblick");
    const tag = await erwarten<{
      stand: { istMinuten: number; pausenMinuten: number; beginn: number; ende: number };
    }>(mia, `/api/v1/arbeitszeit/tag?datum=${samstag}&nutzerId=${nutzer("tom")}`, {
      method: "GET",
    });
    const { istMinuten, pausenMinuten, beginn, ende } = tag.stand;
    // 20:00 summer time to 3:30 winter time: 7.5 hours on the clock, 8.5 real hours
    expect(new Date(beginn).toISOString()).toMatch(/^2026-10-24T1[78]:/);
    expect(new Date(ende).toISOString()).toMatch(/^2026-10-25T02:3/);
    expect(istMinuten).toBe((ende - beginn) / 60_000 - pausenMinuten);
    expect(istMinuten).toBeGreaterThan(8 * 60 - 20);
  });

  it("refuses a directory that already holds a soll.db", async () => {
    expect(
      await demoAnlegen({ ziel, heute: HEUTE, geheimerSchluessel: schluessel, url: URL }),
    ).toEqual({ ok: false, grund: "vorhanden" });
  });

  it("is deterministic: the same day gives the same events, and the terminal stamped at their times", () => {
    const einmal = ereignisseBis(HEUTE).ereignisse;
    expect(ereignisseBis(HEUTE).ereignisse).toEqual(einmal);
    const geplant = einmal
      .filter((e) => e.betrieb === "cafe" && e.handlung.art === "stempeln")
      .map((e) => e.zeit);
    const gestempelt = offen.sqlite
      .query("SELECT zeitpunkt FROM stempelungen WHERE quelle = 'terminal' ORDER BY zeitpunkt")
      .all() as { zeitpunkt: number }[];
    expect(gestempelt.map((s) => s.zeitpunkt)).toEqual(geplant);
  });

  it.each(["2026-12-01", "2027-01-01", "2026-03-01", "2026-04-01"])(
    "closes all three full months also when --heute is the 1st (%s)",
    (heute) => {
      const { ereignisse, zeitraum: zr } = ereignisseBis(heute);
      const abschluesse = ereignisse.filter((e) => e.handlung.art === "abschliessen");
      expect(abschluesse).toHaveLength(27);
      // after the corrections of the morning, before the story ends
      expect(Math.max(...abschluesse.map((e) => e.zeit))).toBeLessThanOrEqual(zr.ende);
    },
  );
});
