import { describe, expect, it } from "vitest";
import { IMP, koerper, uebernehmen, vorschauVon, weberZumUmzug } from "./importe-testhilfen.ts";

import { anpassen, type Json, json } from "./konten-testhilfen.ts";

/*
 * The balances on a cut-off date from an import (BAULISTE.md S-708): Sandra's times of September and
 * her balances on 1 September, Max's balance without any time in Soll (he joined on 25 November),
 * Leon left out. Today is 25 November 2026.
 */

const KOPF =
  "Typ;Kennung;Person;Datum;Beginn;Ende;Pause;Bis;Art;Kunde;Name;Nummer;Überstunden;Resturlaub";
const SALDEN_CSV = (sandra = "-3:15") =>
  [
    KOPF,
    "zeit;z-1;Sandra;01.09.2026;7:00;15:30;30;;;;;;;",
    "zeit;z-2;Sandra;02.09.2026;7:00;15:30;30;;;;;;;",
    `saldo;s-1;Sandra;01.09.2026;;;;;;;;;${sandra};8,5`,
    "saldo;s-2;Max Brandt;01.10.2026;;;;;;;;;12:00;",
    "saldo;s-3;Leon;01.09.2026;;;;;;;;;1:00;2",
    "",
  ].join("\r\n");

const zuordnung = (sandra: string, max: string) => ({
  personen: { Sandra: sandra, "Max Brandt": max, Leon: null },
  arten: {},
  kunden: {},
  projekte: {},
  taetigkeiten: {},
});

const anpassungen = (server: Awaited<ReturnType<typeof weberZumUmzug>>["server"]) =>
  server.sqlite
    .query(
      "SELECT nutzer_id, art, monat, minuten, halbtage, grund, import_id, extern_quelle, extern_id FROM konto_anpassungen ORDER BY extern_id",
    )
    .all() as Json[];

describe("balances on a cut-off date from a Soll-CSV (S-708)", () => {
  it("previews the balances of the file for the owner to check", async () => {
    const { weber } = await weberZumUmzug();
    const vorschau = await json(await vorschauVon(weber, SALDEN_CSV()));
    expect((vorschau.anzahl as Json).salden).toBe(3);
    expect((vorschau.salden as Json).liste).toEqual([
      {
        zeile: 4,
        person: "Sandra",
        stichtag: "2026-09-01",
        ueberstundenMinuten: -195,
        urlaubHalbtage: 17,
      },
      {
        zeile: 5,
        person: "Max Brandt",
        stichtag: "2026-10-01",
        ueberstundenMinuten: 720,
        urlaubHalbtage: null,
      },
      {
        zeile: 6,
        person: "Leon",
        stichtag: "2026-09-01",
        ueberstundenMinuten: 60,
        urlaubHalbtage: 4,
      },
    ]);
  });

  it("runs dry by the rules of the accounts, takes over with origin, and closes after", async () => {
    const { server, weber, sandra, max } = await weberZumUmzug();
    const body = koerper(zuordnung(sandra.nutzerId, max.nutzerId), SALDEN_CSV(), "2026-09");
    const probe = await json(await weber.anfrage(`${IMP}/probelauf`, { body }));
    expect((probe.zahlen as Json).salden).toEqual({
      neu: 1,
      vorhanden: 0,
      ausgelassen: 1,
      abgelehnt: 1,
    });
    expect((probe.abgelehnt as Json).liste).toEqual([
      { art: "salden", zeile: 5, externalId: "s-2", grund: "vor_eintritt" },
    ]);
    expect(anpassungen(server)).toEqual([]);

    const erster = await uebernehmen(weber, body);
    const kurz = (erster.importId as string).slice(0, 8);
    const grund = `übernommen aus Soll-CSV (Import ${kurz})`;
    expect(anpassungen(server)).toEqual([
      {
        nutzer_id: sandra.nutzerId,
        art: "startsaldo",
        monat: "2026-09",
        minuten: -195,
        halbtage: null,
        grund,
        import_id: erster.importId,
        extern_quelle: "soll-csv",
        extern_id: "s-1/ueberstunden",
      },
      {
        nutzer_id: sandra.nutzerId,
        art: "urlaub_stichtag",
        monat: "2026-09",
        minuten: null,
        halbtage: 17,
        grund,
        import_id: erster.importId,
        extern_quelle: "soll-csv",
        extern_id: "s-1/urlaub",
      },
    ]);
    // September was closed after the balances went in: its content and Prüfwert carry them
    expect(erster.gesperrt).toEqual([{ nutzerId: sandra.nutzerId, monat: "2026-09" }]);
    const monat = await json(
      await weber.anfrage(`/api/v1/arbeitszeit/monat?monat=2026-09&nutzerId=${sandra.nutzerId}`),
    );
    expect(((monat.abschluss as Json).inhalt as Json).startsalden).toEqual([
      { art: "ueberstunden", minuten: -195, grund },
      { art: "urlaub", halbtage: 17, grund },
    ]);
    // the Auskunft names import, tool and id of each balance taken over (Art. 15 DSGVO)
    const auskunft = await json(await sandra.anfrage("/api/v1/auskunft"));
    expect(
      (auskunft.kontoAnpassungen as Json[]).map((a) => [
        a.art,
        a.importId,
        a.externQuelle,
        a.externId,
      ]),
    ).toEqual([
      ["startsaldo", erster.importId, "soll-csv", "s-1/ueberstunden"],
      ["urlaub_stichtag", erster.importId, "soll-csv", "s-1/urlaub"],
    ]);
  });

  it("finds them again: a second run creates nothing, a changed value is reported, never overwritten", async () => {
    const { server, weber, sandra, max } = await weberZumUmzug();
    const body = koerper(zuordnung(sandra.nutzerId, max.nutzerId), SALDEN_CSV());
    await uebernehmen(weber, body);
    const vorher = anpassungen(server);
    const zweiter = await uebernehmen(weber, body);
    expect((zweiter.zahlen as Json).salden).toMatchObject({ neu: 0, vorhanden: 1 });
    const geaendert = koerper(zuordnung(sandra.nutzerId, max.nutzerId), SALDEN_CSV("-2:00"));
    const dritter = await uebernehmen(weber, geaendert);
    expect((dritter.abgelehnt as Json).liste).toContainEqual({
      art: "salden",
      zeile: 4,
      externalId: "s-1",
      grund: "geaendert_im_alten_tool",
    });
    expect(anpassungen(server)).toEqual(vorher);
  });

  it("refuses a balance where the person has a start by hand already", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    const nurSandra = [KOPF, "saldo;s-1;Sandra;01.11.2026;;;;;;;;;1:00;", ""].join("\r\n");
    const start = { art: "startsaldo", monat: "2026-11", minuten: 30 };
    expect((await anpassen(weber, sandra, start)).status).toBe(201);
    const body = koerper(zuordnung(sandra.nutzerId, max.nutzerId), nurSandra);
    const probe = await json(await weber.anfrage(`${IMP}/probelauf`, { body }));
    expect((probe.abgelehnt as Json).liste).toEqual([
      { art: "salden", zeile: 2, externalId: "s-1", grund: "saldo_vorhanden" },
    ]);
  });

  it("refuses two balances of one person in one file, and one in the future", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    const text = [
      KOPF,
      "saldo;s-1;Sandra;01.11.2026;;;;;;;;;1:00;",
      "saldo;s-2;Sandra;01.11.2026;;;;;;;;;;2",
      "saldo;s-3;Max Brandt;01.12.2026;;;;;;;;;1:00;",
      "",
    ].join("\r\n");
    const body = koerper(zuordnung(sandra.nutzerId, max.nutzerId), text);
    const probe = await json(await weber.anfrage(`${IMP}/probelauf`, { body }));
    expect((probe.abgelehnt as Json).liste).toEqual([
      { art: "salden", zeile: 3, externalId: "s-2", grund: "saldo_vorhanden" },
      { art: "salden", zeile: 4, externalId: "s-3", grund: "zukunft" },
    ]);
  });

  it("is the owner's: a planner gets 403 and nothing is written", async () => {
    const { server, anna, sandra, max } = await weberZumUmzug();
    const body = koerper(zuordnung(sandra.nutzerId, max.nutzerId), SALDEN_CSV());
    expect((await anna.anfrage(IMP, { body })).status).toBe(403);
    expect(anpassungen(server)).toEqual([]);
  });

  it("maps no balance to a person of another business", async () => {
    const { server, weber, sandra } = await weberZumUmzug();
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    const tom = await server.eingeladen(mia, "mitarbeiter", "tom");
    const body = koerper(zuordnung(sandra.nutzerId, tom.nutzerId), SALDEN_CSV());
    const antwort = await weber.anfrage(IMP, { body });
    expect(antwort.status).toBe(422);
    expect(anpassungen(server)).toEqual([]);
  });
});
