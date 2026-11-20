import { describe, expect, it } from "vitest";
import { abgeschlossen, JETZT, pruefen, um } from "./monat-testhilfen.ts";

describe("the check page", () => {
  it("says übereinstimmend for the Prüfwert of a month as closed", async () => {
    const { server, jonas, pruefwert } = await abgeschlossen();
    expect(await pruefen(server, jonas.betriebId, pruefwert)).toEqual({
      ergebnis: "uebereinstimmend",
      grund: null,
      monat: "2026-10",
      abgeschlossenAm: JETZT,
      tage: [],
      gegeneintraege: [],
      betrieb: "Weber Haustechnik",
      name: "sandra",
    });
    // also as typed by hand: capitals, line break
    const getippt = pruefwert.toUpperCase().replace(" · ", "\n");
    expect((await pruefen(server, jonas.betriebId, getippt)).ergebnis).toBe("uebereinstimmend");
  });

  it("shows a later change of a closed month as Abweichung with the day (Fertig, wenn)", async () => {
    const { server, jonas, pruefwert, ids } = await abgeschlossen();
    // whoever runs the server changes the database past the chain
    server.sqlite
      .query("UPDATE stempelungen SET zeitpunkt = zeitpunkt + 3600000 WHERE stempel_id = ?")
      .run(ids.gehen);
    expect(await pruefen(server, jonas.betriebId, pruefwert)).toMatchObject({
      ergebnis: "abweichung",
      grund: "tage",
      monat: "2026-10",
      tage: ["2026-10-06"],
    });
  });

  it("shows a stamp removed or added past the chain, also after midnight of the night shift", async () => {
    const { server, jonas, sandra, pruefwert, ids } = await abgeschlossen();
    server.sqlite.query("DELETE FROM stempelungen WHERE stempel_id = ?").run(ids.nachtGehen);
    server.sqlite
      .query(
        `INSERT INTO stempelungen (betrieb_id, stempel_id, nutzer_id, art, zeitpunkt, quelle,
         entfernt, erstellt_von, erstellt_am) VALUES (?, 'x', ?, 'kommen', ?, 'app', 0, ?, ?)`,
      )
      .run(
        jonas.betriebId,
        sandra.nutzerId,
        um("2026-10-20T08:00:00+02:00"),
        sandra.nutzerId,
        JETZT,
      );
    expect(await pruefen(server, jonas.betriebId, pruefwert)).toMatchObject({
      ergebnis: "abweichung",
      tage: ["2026-10-20", "2026-10-31"],
    });
  });

  it("shows a changed model past the chain as Abweichung on the days of its Soll", async () => {
    const { server, jonas, pruefwert } = await abgeschlossen();
    server.sqlite
      .query("UPDATE arbeitszeitmodelle SET soll_minuten = '[480,480,480,480,420,0,0]'")
      .run();
    const ergebnis = await pruefen(server, jonas.betriebId, pruefwert);
    expect(ergebnis.ergebnis).toBe("abweichung");
    expect(ergebnis.tage).toEqual([
      "2026-10-02",
      "2026-10-09",
      "2026-10-16",
      "2026-10-23",
      "2026-10-30",
    ]);
  });

  it("shows a changed closing row and a chain computed anew as Abweichung", async () => {
    const zeile = await abgeschlossen();
    zeile.server.sqlite
      .query("UPDATE monatsabschluesse SET grund = 'geändert' WHERE schritt = 'abgeschlossen'")
      .run();
    expect(await pruefen(zeile.server, zeile.jonas.betriebId, zeile.pruefwert)).toEqual({
      ergebnis: "abweichung",
      grund: "abschluss",
      betrieb: "Weber Haustechnik",
    });

    const kette = await abgeschlossen();
    const [nummer] = /\d+/.exec(kette.pruefwert) ?? [];
    kette.server.sqlite
      .query("UPDATE audit_glieder SET hash = ? WHERE betrieb_id = ? AND seq = ?")
      .run("cd".repeat(32), kette.jonas.betriebId, Number(nummer));
    expect(await pruefen(kette.server, kette.jonas.betriebId, kette.pruefwert)).toMatchObject({
      ergebnis: "abweichung",
      grund: "kette",
    });
  });

  it("does not take a Prüfwert of another business, nor gibberish", async () => {
    const { server, pruefwert } = await abgeschlossen();
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    expect((await pruefen(server, mia.betriebId, pruefwert)).ergebnis).not.toBe("uebereinstimmend");
    expect((await pruefen(server, "gibt-es-nicht", pruefwert)).ergebnis).toBe("unbekannt");
    expect((await pruefen(server, mia.betriebId, "hallo")).ergebnis).toBe("unlesbar");
    const leer = await server.browser().anfrage("/api/v1/pruefen", { body: { betriebId: "x" } });
    expect(leer.status).toBe(400);
  });
});
