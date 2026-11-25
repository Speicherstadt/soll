import { describe, expect, it } from "vitest";
import {
  datei,
  IMP,
  koerper,
  uebernehmen,
  vorschauVon,
  WEBER_CSV,
  weberZumUmzug,
  zuordnungFuer,
} from "./importe-testhilfen.ts";
import { json } from "./projektzeit-testhilfen.ts";

describe("an import from another tool (S-701)", () => {
  it("previews the file: records, lines it cannot read, proposals and findings", async () => {
    const { weber, sandra } = await weberZumUmzug();
    const vorschau = await json(await vorschauVon(weber));
    expect(vorschau.anzahl).toEqual({
      zeiten: 4,
      abwesenheiten: 1,
      kunden: 1,
      projekte: 1,
      taetigkeiten: 0,
    });
    expect(vorschau.lesefehler).toEqual({
      anzahl: 1,
      liste: [{ zeile: 6, grund: "datum_ungueltig", feld: "datum", wert: "31.09.2026" }],
    });
    expect(vorschau.personen).toEqual([
      { person: "Leon", datensaetze: 1, vorschlag: null },
      { person: "Max Brandt", datensaetze: 1, vorschlag: null },
      { person: "Sandra", datensaetze: 3, vorschlag: sandra.nutzerId },
    ]);
    expect(vorschau.arten).toEqual([{ art: "Urlaub", datensaetze: 1, vorschlag: "urlaub" }]);
    // Max worked 11:30 without a break on 1 October in the old tool: shown, not changed
    const befunde = vorschau.befunde as { liste: { person: string; regel: string }[] };
    expect(new Set(befunde.liste.map((b) => `${b.person} ${b.regel}`))).toEqual(
      new Set(["Max Brandt R-02", "Max Brandt R-04"]),
    );
  });

  it("runs dry without writing, takes over, and a second run creates nothing twice", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    const body = koerper(zuordnungFuer(sandra.nutzerId, max.nutzerId));
    const probe = await json(await weber.anfrage(`${IMP}/probelauf`, { body }));
    expect(probe.zahlen).toEqual({
      zeiten: { neu: 3, vorhanden: 0, ausgelassen: 1, abgelehnt: 0 },
      abwesenheiten: { neu: 1, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 },
      kunden: { neu: 1, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 },
      projekte: { neu: 1, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 },
      taetigkeiten: { neu: 0, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 },
      buchungen: { neu: 0, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 },
    });
    expect(await json(await weber.anfrage(IMP))).toEqual({ importe: [] });

    const erster = await uebernehmen(weber, body);
    expect(erster.zahlen).toEqual(probe.zahlen);
    const zweiter = await uebernehmen(weber, body);
    expect(zweiter.zahlen).toEqual({
      zeiten: { neu: 0, vorhanden: 3, ausgelassen: 1, abgelehnt: 0 },
      abwesenheiten: { neu: 0, vorhanden: 1, ausgelassen: 0, abgelehnt: 0 },
      kunden: { neu: 0, vorhanden: 1, ausgelassen: 0, abgelehnt: 0 },
      projekte: { neu: 0, vorhanden: 1, ausgelassen: 0, abgelehnt: 0 },
      taetigkeiten: { neu: 0, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 },
      buchungen: { neu: 0, vorhanden: 0, ausgelassen: 0, abgelehnt: 0 },
    });
    const kunden = (await json(await weber.anfrage("/api/v1/projektzeit/kunden"))) as unknown;
    expect(JSON.stringify(kunden).match(/Elbhof Immobilien/g)).toHaveLength(1);
    const liste = (await json(await weber.anfrage(IMP))).importe as { quelleName: string }[];
    expect(liste.map((i) => i.quelleName)).toEqual(["Soll-CSV", "Soll-CSV"]);
  });

  it("stamps a span as Kommen, Pause and Gehen, marked as taken over, and approves the leave", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    await uebernehmen(weber, koerper(zuordnungFuer(sandra.nutzerId, max.nutzerId)));
    const tag = await json(
      await weber.anfrage(`/api/v1/arbeitszeit/tag?datum=2026-09-01&nutzerId=${sandra.nutzerId}`),
    );
    const stempel = tag.stempelungen as {
      art: string;
      zeitpunkt: number;
      uebernommenAus?: string;
    }[];
    expect(stempel.map((s) => [s.art, new Date(s.zeitpunkt).toISOString()])).toEqual([
      ["kommen", "2026-09-01T05:00:00.000Z"],
      ["pause_beginn", "2026-09-01T09:00:00.000Z"],
      ["pause_ende", "2026-09-01T09:30:00.000Z"],
      ["gehen", "2026-09-01T13:30:00.000Z"],
    ]);
    expect(stempel.every((s) => s.uebernommenAus === "soll-csv")).toBe(true);
    const abwesenheiten = await json(
      await sandra.anfrage("/api/v1/arbeitszeit/abwesenheiten?jahr=2026"),
    );
    expect(JSON.stringify(abwesenheiten)).toContain('"status":"genehmigt"');
  });

  it("keeps the original file under its SHA-256 for the owner to download", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    const ergebnis = await uebernehmen(
      weber,
      koerper(zuordnungFuer(sandra.nutzerId, max.nutzerId)),
    );
    const sha256 = new Bun.CryptoHasher("sha256").update(WEBER_CSV).digest("hex");
    expect(ergebnis.dateiSha256).toBe(sha256);
    const antwort = await weber.anfrage(`${IMP}/${ergebnis.importId}/datei`);
    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("content-disposition")).toContain("altes-tool.csv");
    expect(await antwort.text()).toBe(WEBER_CSV);
    expect((await weber.anfrage(`${IMP}/unbekannt/datei`)).status).toBe(404);
  });

  it("closes the months the old tool had closed, with a Prüfwert and the reason", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    const body = koerper(zuordnungFuer(sandra.nutzerId, max.nutzerId), WEBER_CSV, "2026-09");
    const ergebnis = await uebernehmen(weber, body);
    expect(ergebnis.gesperrt).toEqual([{ nutzerId: sandra.nutzerId, monat: "2026-09" }]);
    const monat = await json(
      await weber.anfrage(`/api/v1/arbeitszeit/monat?monat=2026-09&nutzerId=${sandra.nutzerId}`),
    );
    const abschluss = monat.abschluss as { grund: string; pruefwert: string };
    expect(abschluss.grund).toMatch(/^übernommen aus Soll-CSV \(Import [0-9a-f]{8}\)$/);
    expect(abschluss.pruefwert).toMatch(/^Nr\. \d+ · [0-9a-f]{64}$/);
    // the month is locked like any other: a stamp entered by hand is refused
    const nachtrag = await weber.anfrage("/api/v1/arbeitszeit/stempelungen/nachtrag", {
      body: {
        nutzerId: sandra.nutzerId,
        art: "kommen",
        zeitpunkt: Date.parse("2026-09-03T07:00:00+02:00"),
        grund: "vergessen",
      },
    });
    expect(nachtrag.status).toBe(409);
    // a second run finds the month closed and changes nothing
    const wieder = await uebernehmen(weber, body);
    expect(wieder.gesperrt).toEqual([]);
    expect(wieder.monate).toEqual([]);
  });

  it("refuses what would change a month closed in Soll, with its line", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    await uebernehmen(
      weber,
      koerper(zuordnungFuer(sandra.nutzerId, max.nutzerId), WEBER_CSV, "2026-09"),
    );
    const neu = `${WEBER_CSV}zeit;z-9;Sandra;03.09.2026;7:00;12:00;;;;;;\r\n`;
    const probe = await json(
      await weber.anfrage(`${IMP}/probelauf`, {
        body: koerper(zuordnungFuer(sandra.nutzerId, max.nutzerId), neu),
      }),
    );
    expect((probe.abgelehnt as { liste: unknown[] }).liste).toEqual([
      { art: "zeiten", zeile: 10, externalId: "z-9", grund: "monat_abgeschlossen" },
    ]);
  });

  it("takes only months before this one as closed, and refuses a file too large", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    const zuordnung = zuordnungFuer(sandra.nutzerId, max.nutzerId);
    const jetzt = await weber.anfrage(IMP, { body: koerper(zuordnung, WEBER_CSV, "2026-11") });
    expect(jetzt.status).toBe(422);
    expect(await jetzt.json()).toEqual({ fehler: "abgeschlossen_bis" });
    const gross = await weber.anfrage(`${IMP}/vorschau`, {
      body: { quelle: "soll-csv", datei: datei("x".repeat(5 * 1024 * 1024 + 1)), spalten: {} },
    });
    expect(gross.status).toBe(413);
    const fremd = await weber.anfrage(`${IMP}/vorschau`, {
      body: { quelle: "excel", datei: datei(WEBER_CSV), spalten: {} },
    });
    expect(fremd.status).toBe(422);
  });

  it("is for the owner only", async () => {
    const { anna, sandra, max } = await weberZumUmzug();
    const body = koerper(zuordnungFuer(sandra.nutzerId, max.nutzerId));
    for (const person of [anna, sandra]) {
      expect((await person.anfrage(IMP)).status).toBe(403);
      expect((await vorschauVon(person)).status).toBe(403);
      expect((await person.anfrage(`${IMP}/probelauf`, { body })).status).toBe(403);
      expect((await person.anfrage(IMP, { body })).status).toBe(403);
    }
  });

  it("refuses times and absences without Arbeitszeit, customers without Projektzeit", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    const aus = await weber.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { projektzeit: false },
    });
    expect(aus.status).toBe(200);
    const probe = await json(
      await weber.anfrage(`${IMP}/probelauf`, {
        body: koerper(zuordnungFuer(sandra.nutzerId, max.nutzerId)),
      }),
    );
    const liste = (probe.abgelehnt as { liste: { art: string; grund: string }[] }).liste;
    expect(liste).toEqual([
      expect.objectContaining({ art: "kunden", grund: "modul_aus" }),
      expect.objectContaining({ art: "projekte", grund: "modul_aus" }),
    ]);
  });
});
