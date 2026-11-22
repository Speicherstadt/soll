import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import {
  AL,
  DANACH,
  einstellen,
  json,
  MONAT,
  novemberBeiWeber,
  team,
  um,
} from "./auslastung-testhilfen.ts";

describe("the utilisation per team (S-604)", () => {
  it("sums stamped against booked time of the team for owner and planner", async () => {
    const { server, weber } = await novemberBeiWeber();
    const anna = await server.eingeladen(weber, "planer", "anna");
    for (const person of [weber, anna]) {
      const antwort = await team(person);
      expect(antwort.status).toBe(200);
      expect(await json(antwort)).toEqual({
        monat: MONAT,
        jePersonSeit: null,
        team: {
          art: "team",
          personen: 3,
          anwesendMinuten: 1_440,
          abrechenbarMinuten: 600,
          internMinuten: 60,
          ohneBuchungMinuten: 780,
          abrechenbarProzent: 42,
        },
      });
    }
  });

  it("refuses the team view to everyone else", async () => {
    const { server, weber, sandra } = await novemberBeiWeber();
    const lohn = await server.eingeladen(weber, "lohnbuero", "lohn");
    const rat = await server.eingeladen(weber, "betriebsrat", "rat");
    for (const person of [sandra, lohn, rat]) expect((await team(person)).status).toBe(403);
  });

  it("gives no numbers for a group of fewer than three people", async () => {
    const { weber } = await novemberBeiWeber({ leonStempelt: false });
    expect((await json(await team(weber))).team).toEqual({
      art: "zu_klein",
      personen: 2,
      mindestens: 3,
    });
  });

  it("shows only months that have ended, so no change between two calls singles out one person", async () => {
    const { server, weber } = await novemberBeiWeber();
    server.stelleUhr(um("16:00"));
    expect(await json(await team(weber))).toEqual({ fehler: "monat_laeuft" });
    expect((await team(weber)).status).toBe(422);
    server.stelleUhr(DANACH);
    expect((await team(weber, "2026-13")).status).toBe(400);
    expect((await weber.anfrage(AL)).status).toBe(400);
  });
});

describe("the utilisation per person (S-604, § 87 Abs. 1 Nr. 6 BetrVG)", () => {
  it("is off until the owner switches it on, and the server refuses its numbers until then", async () => {
    const { weber, sandra } = await novemberBeiWeber();
    for (const [person, pfad] of [
      [weber, `${AL}/personen?monat=${MONAT}`],
      [sandra, `${AL}/ich?monat=${MONAT}`],
      [weber, `${AL}/ich?monat=${MONAT}`],
    ] as const) {
      const antwort = await person.anfrage(pfad);
      expect(antwort.status, pfad).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "auswertung_aus" });
    }
  });

  it("is switched by the owner only, through the audit chain with actor and time", async () => {
    const { server, weber, sandra } = await novemberBeiWeber();
    const anna = await server.eingeladen(weber, "planer", "anna");
    expect((await einstellen(anna, true)).status).toBe(403);
    expect((await einstellen(sandra, true)).status).toBe(403);
    expect((await weber.anfrage(`${AL}/einstellung`, { method: "PUT", body: {} })).status).toBe(
      400,
    );
    const an = await einstellen(weber, true);
    expect(an.status).toBe(200);
    expect(await json(an)).toEqual({ jePersonSeit: DANACH });
    const glied = server.sqlite
      .query(
        "SELECT g.akteur, g.zeitpunkt, g.aktion, i.inhalt FROM audit_glieder g JOIN audit_inhalte i USING (betrieb_id, seq) WHERE g.betrieb_id = ? AND g.tabelle = 'betriebe' ORDER BY g.seq DESC LIMIT 1",
      )
      .get(weber.betriebId) as {
      akteur: string;
      zeitpunkt: number;
      aktion: string;
      inhalt: string;
    };
    expect(glied).toMatchObject({ akteur: weber.nutzerId, zeitpunkt: DANACH, aktion: "aendern" });
    expect(JSON.parse(glied.inhalt)).toMatchObject({ auswertungJePersonSeit: DANACH });
    expect(kettePruefen(server.db, weber.betriebId)).toEqual([]);

    // switched on again later: since the first time; off: gone, and refused again
    server.stelleUhr(DANACH + 60_000);
    expect(await json(await einstellen(weber, true))).toEqual({ jePersonSeit: DANACH });
    expect(await json(await einstellen(weber, false))).toEqual({ jePersonSeit: null });
    expect((await weber.anfrage(`${AL}/personen?monat=${MONAT}`)).status).toBe(403);
  });

  it("is shown to every member with GET /betrieb while it is on", async () => {
    const { weber, sandra } = await novemberBeiWeber();
    expect((await json(await sandra.anfrage("/api/v1/betrieb"))).auswertungJePersonSeit).toBeNull();
    await einstellen(weber, true);
    for (const person of [weber, sandra])
      expect((await json(await person.anfrage("/api/v1/betrieb"))).auswertungJePersonSeit).toBe(
        DANACH,
      );
    await weber.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { projektzeit: false },
    });
    expect((await json(await sandra.anfrage("/api/v1/betrieb"))).auswertungJePersonSeit).toBeNull();
  });

  it("when on, lists each person for owner and planner and gives everyone their own", async () => {
    const { server, weber, sandra, max, leon } = await novemberBeiWeber();
    await einstellen(weber, true);
    const liste = await json(await weber.anfrage(`${AL}/personen?monat=${MONAT}`));
    expect(liste.jePersonSeit).toBe(DANACH);
    const personen = liste.personen as { nutzerId: string; name: string }[];
    expect(personen.map((p) => p.name).sort()).toEqual(["leon", "max", "sandra"]);
    expect(personen.find((p) => p.nutzerId === sandra.nutzerId)).toEqual({
      nutzerId: sandra.nutzerId,
      name: "sandra",
      anwesendMinuten: 480,
      abrechenbarMinuten: 360,
      internMinuten: 60,
      ohneBuchungMinuten: 60,
      abrechenbarProzent: 75,
    });
    const anna = await server.eingeladen(weber, "planer", "anna");
    expect((await anna.anfrage(`${AL}/personen?monat=${MONAT}`)).status).toBe(200);
    expect((await sandra.anfrage(`${AL}/personen?monat=${MONAT}`)).status).toBe(403);

    expect((await json(await max.anfrage(`${AL}/ich?monat=${MONAT}`))).eigene).toEqual({
      nutzerId: max.nutzerId,
      anwesendMinuten: 480,
      abrechenbarMinuten: 240,
      internMinuten: 0,
      ohneBuchungMinuten: 240,
      abrechenbarProzent: 50,
    });
    expect((await json(await leon.anfrage(`${AL}/ich?monat=2026-10`))).eigene).toEqual({
      nutzerId: leon.nutzerId,
      anwesendMinuten: 0,
      abrechenbarMinuten: 0,
      internMinuten: 0,
      ohneBuchungMinuten: 0,
      abrechenbarProzent: null,
    });
  });

  it("when on, shows the running month per person up to now", async () => {
    const { server, weber, sandra } = await novemberBeiWeber();
    server.stelleUhr(um("16:00"));
    await einstellen(weber, true);
    const eigene = (await json(await sandra.anfrage(`${AL}/ich?monat=${MONAT}`))).eigene;
    expect(eigene).toMatchObject({ anwesendMinuten: 480, abrechenbarMinuten: 360 });
  });
});
