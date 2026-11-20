import { pdfText } from "@soll/export";
import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { smtpMailer } from "../modules/mail/index.ts";
import { smtpTestServer } from "../modules/mail/smtp-test.ts";
import { testServer } from "../test-server.ts";
import {
  abgeschlossen,
  abschliessen,
  bestaetigen,
  JETZT,
  type Json,
  json,
  nachtrag,
  type Person,
  pruefen,
  um,
  weber,
} from "./monat-testhilfen.ts";

describe("confirming and closing a month", () => {
  it("closes after the person confirmed, with sums, findings and a Prüfwert of the chain", async () => {
    const { daten, pruefwert, sandra, jonas, server } = await abgeschlossen();
    expect(pruefwert).toMatch(/^Nr\. \d+ · [0-9a-f]{64}$/);
    expect(daten.mail).toBe("nicht_eingerichtet");
    const inhalt = daten.inhalt as Json;
    // 22 working days of 8 h in October 2026 in Hamburg (3 October is a Saturday; no holiday on a
    // weekday), worked 8:00 on the 6th and 6:00 in the night shift
    expect(inhalt.summen).toEqual({
      sollMinuten: 22 * 480,
      gearbeitetMinuten: 480 + 360,
      gutschriftMinuten: 0,
      istMinuten: 840,
      saldoMinuten: 840 - 22 * 480,
    });
    const tage = inhalt.tage as { tag: string; stempel: unknown[] }[];
    expect(tage.find((t) => t.tag === "2026-10-31")?.stempel).toEqual([
      ["kommen", um("2026-10-31T20:00:00+01:00")],
      ["gehen", um("2026-11-01T02:00:00+01:00")],
    ]);
    expect(daten.bestaetigung).toMatchObject({ von: sandra.nutzerId, gueltig: true });
    expect(daten.abschluss).toMatchObject({ von: jonas.nutzerId, grund: null });
    expect(daten.geaenderteTage).toEqual(["2026-10-06", "2026-10-31"]);
    expect(kettePruefen(server.db, jonas.betriebId)).toEqual([]);
    // the Prüfwert is the link of the closing row
    const [nummer] = /\d+/.exec(pruefwert) ?? [];
    expect(
      server.sqlite
        .query("SELECT tabelle, aktion FROM audit_glieder WHERE betrieb_id = ? AND seq = ?")
        .get(jonas.betriebId, Number(nummer)),
    ).toEqual({ tabelle: "monatsabschluesse", aktion: "einfuegen" });
  });

  it("shows the person and the owner the same closed month", async () => {
    const { sandra, jonas, pruefwert } = await abgeschlossen();
    const eigen = await json(await sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-10"));
    const inhaber = await json(
      await jonas.anfrage(`/api/v1/arbeitszeit/monat?monat=2026-10&nutzerId=${sandra.nutzerId}`),
    );
    expect((eigen.abschluss as Json).pruefwert).toBe(pruefwert);
    expect(eigen.eigen).toBe(true);
    expect(inhaber.eigen).toBe(false);
    expect({ ...inhaber, eigen: true }).toEqual(eigen);
    expect(eigen.name).toBe("sandra");
  });

  it("refuses to close without the person's confirmation, except with a reason", async () => {
    const { jonas, sandra } = await weber();
    const ohne = await abschliessen(jonas, sandra.nutzerId);
    expect(ohne.status).toBe(409);
    expect(await json(ohne)).toEqual({ fehler: "bestaetigung_fehlt" });
    const mit = await json(await abschliessen(jonas, sandra.nutzerId, { grund: "ausgeschieden" }));
    expect(mit.abschluss).toMatchObject({ grund: "ausgeschieden" });
    expect(mit.bestaetigung).toBeNull();
  });

  it("does not count a confirmation once the records changed after it", async () => {
    const { jonas, sandra, ids } = await weber();
    await bestaetigen(sandra);
    await jonas.anfrage(`/api/v1/arbeitszeit/stempelungen/${ids.gehen}`, {
      method: "PATCH",
      body: { art: "gehen", zeitpunkt: um("2026-10-06T17:00:00+02:00"), grund: "Baustelle" },
    });
    const stand = await json(await sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-10"));
    expect(stand.bestaetigung).toMatchObject({ gueltig: false });
    expect((await abschliessen(jonas, sandra.nutzerId)).status).toBe(409);
    expect((await bestaetigen(sandra)).status).toBe(201);
    expect((await abschliessen(jonas, sandra.nutzerId)).status).toBe(201);
  });

  it("refuses a running month, a month closed already and a month with an open shift", async () => {
    const { server, jonas, sandra, tag } = await weber();
    const laufend = await bestaetigen(sandra, "2026-11");
    expect(await json(laufend)).toEqual({ fehler: "monat_laeuft" });
    await tag(sandra, [["kommen", "2026-09-10T08:00:00+02:00"]]);
    expect(await json(await bestaetigen(sandra, "2026-09"))).toEqual({ fehler: "offene_schicht" });
    await bestaetigen(sandra);
    await abschliessen(jonas, sandra.nutzerId);
    const zweimal = await abschliessen(jonas, sandra.nutzerId, { grund: "nochmal" });
    expect(zweimal.status).toBe(409);
    expect(await json(zweimal)).toEqual({ fehler: "abgeschlossen" });
    expect(await json(await bestaetigen(sandra))).toEqual({ fehler: "abgeschlossen" });
    expect(
      server.sqlite
        .query("SELECT COUNT(*) AS n FROM monatsabschluesse WHERE schritt = 'abgeschlossen'")
        .get(),
    ).toEqual({ n: 1 });
  });

  it("lets only the owner close, and each person confirm only their own month", async () => {
    const { anna, lohn, sandra } = await weber();
    for (const wer of [anna, lohn, sandra]) {
      const antwort = await abschliessen(wer, sandra.nutzerId, { grund: "x" });
      expect(antwort.status).toBe(403);
    }
    expect(
      (
        await sandra.anfrage("/api/v1/arbeitszeit/monat/bestaetigen", {
          body: { monat: "2026-10", nutzerId: anna.nutzerId },
        })
      ).status,
    ).toBe(400);
  });

  it("shows a month to the person, owner, planner and payroll, not to a colleague", async () => {
    const { server, jonas, sandra, anna, lohn } = await weber();
    const max = await server.eingeladen(jonas, "mitarbeiter", "max");
    const pfad = `/api/v1/arbeitszeit/monat?monat=2026-10&nutzerId=${sandra.nutzerId}`;
    for (const wer of [jonas, anna, lohn, sandra])
      expect((await wer.anfrage(pfad)).status).toBe(200);
    expect((await max.anfrage(pfad)).status).toBe(403);
    expect((await max.anfrage(`${pfad.replace("monat?", "monat/stundenzettel?")}`)).status).toBe(
      403,
    );
    expect((await sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-13")).status).toBe(400);
  });

  it("is refused while working time is switched off", async () => {
    const server = testServer();
    const solo = await server.inhaberMitBetrieb("Lotsenbüro", "lotse");
    await solo.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { arbeitszeit: false } });
    const routen: [string, string, unknown?][] = [
      ["GET", "/api/v1/arbeitszeit/monat?monat=2026-10"],
      ["GET", "/api/v1/arbeitszeit/monat/stundenzettel?monat=2026-10"],
      ["POST", "/api/v1/arbeitszeit/monat/bestaetigen", { monat: "2026-10" }],
      [
        "POST",
        "/api/v1/arbeitszeit/monat/abschliessen",
        { monat: "2026-10", nutzerId: solo.nutzerId },
      ],
      [
        "POST",
        "/api/v1/arbeitszeit/monat/gegeneintrag",
        { nutzerId: solo.nutzerId, tag: "2026-10-06", minuten: 15, grund: "x" },
      ],
    ];
    for (const [method, pfad, body] of routen) {
      const antwort = await solo.anfrage(pfad, { method, body });
      expect(antwort.status, `${method} ${pfad}`).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "modul_aus", modul: "arbeitszeit" });
    }
  });
});

describe("a closed month is locked", () => {
  const abgelehnt = async (antwort: Response) => {
    expect(antwort.status).toBe(409);
    expect(await json(antwort)).toEqual({ fehler: "abgeschlossen" });
  };

  it("refuses adding, changing and removing a stamp in it, for the person and the owner", async () => {
    const { server, jonas, sandra, ids } = await abgeschlossen();
    const vorher = server.sqlite.query("SELECT COUNT(*) AS n FROM stempelungen").get();
    await abgelehnt(
      await nachtrag(sandra, {
        art: "kommen",
        zeitpunkt: um("2026-10-07T08:00:00+02:00"),
        grund: "x",
      }),
    );
    await abgelehnt(
      await nachtrag(jonas, {
        nutzerId: sandra.nutzerId,
        art: "kommen",
        zeitpunkt: um("2026-10-07T08:00:00+02:00"),
        grund: "x",
      }),
    );
    await abgelehnt(
      await jonas.anfrage(`/api/v1/arbeitszeit/stempelungen/${ids.gehen}`, {
        method: "PATCH",
        body: { art: "gehen", zeitpunkt: um("2026-10-06T17:00:00+02:00"), grund: "x" },
      }),
    );
    await abgelehnt(
      await sandra.anfrage(`/api/v1/arbeitszeit/stempelungen/${ids.pauseBeginn}/entfernen`, {
        body: { grund: "x" },
      }),
    );
    // moving a stamp from an open month into the closed one
    const september = await json(
      await nachtrag(sandra, {
        art: "kommen",
        zeitpunkt: um("2026-11-03T08:00:00+01:00"),
        grund: "x",
      }),
    );
    await abgelehnt(
      await sandra.anfrage(`/api/v1/arbeitszeit/stempelungen/${september.stempelId}`, {
        method: "PATCH",
        body: { art: "kommen", zeitpunkt: um("2026-10-30T08:00:00+01:00"), grund: "x" },
      }),
    );
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM stempelungen").get()).toEqual({
      n: (vorher as { n: number }).n + 1,
    });
  });

  it("refuses a change after midnight that belongs to the night shift of the closed month", async () => {
    const { jonas, sandra, ids } = await abgeschlossen();
    await abgelehnt(
      await jonas.anfrage(`/api/v1/arbeitszeit/stempelungen/${ids.nachtGehen}`, {
        method: "PATCH",
        body: { art: "gehen", zeitpunkt: um("2026-11-01T03:00:00+01:00"), grund: "x" },
      }),
    );
    await abgelehnt(
      await jonas.anfrage(`/api/v1/arbeitszeit/stempelungen/${ids.nachtGehen}/entfernen`, {
        body: { grund: "x" },
      }),
    );
    // a break at 1 o'clock would be part of the shift of 31 October
    await abgelehnt(
      await nachtrag(sandra, {
        art: "pause_beginn",
        zeitpunkt: um("2026-11-01T01:00:00+01:00"),
        grund: "x",
      }),
    );
    // a new shift on 1 November (more than 9 h after the Gehen) is November's own
    const neu = await nachtrag(sandra, {
      art: "kommen",
      zeitpunkt: um("2026-11-01T14:00:00+01:00"),
      grund: "Notdienst",
    });
    expect(neu.status).toBe(201);
  });

  it("closes only 9 h after the night shift, then refuses only a stamp added into it", async () => {
    const w = await weber();
    // the night shift ended 1 November 2:00: until 11:00 a Kommen would continue it
    w.server.stelleUhr(um("2026-11-01T03:00:00+01:00"));
    await bestaetigen(w.sandra);
    const zuFrueh = await abschliessen(w.jonas, w.sandra.nutzerId);
    expect(zuFrueh.status).toBe(409);
    expect(await json(zuFrueh)).toEqual({
      fehler: "schicht_kann_weiterlaufen",
      ab: um("2026-11-01T11:00:00+01:00"),
    });
    w.server.stelleUhr(um("2026-11-01T11:00:00+01:00"));
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
    // a Kommen added by hand at 4:00 would continue the closed night shift
    await abgelehnt(
      await nachtrag(w.sandra, {
        art: "kommen",
        zeitpunkt: um("2026-11-01T04:00:00+01:00"),
        grund: "x",
      }),
    );
    w.server.stelleUhr(um("2026-11-01T12:00:00+01:00"));
    expect(
      (await w.sandra.anfrage("/api/v1/arbeitszeit/stempelungen", { body: { art: "kommen" } }))
        .status,
    ).toBe(201);
  });

  it("refuses a model assignment that would change the Soll of the closed month", async () => {
    const { jonas, sandra, modell } = await abgeschlossen();
    const zuordnen = (gueltigAb: string) =>
      jonas.anfrage(`/api/v1/arbeitszeit/personen/${sandra.nutzerId}/modell`, {
        method: "PUT",
        body: { modellId: modell.modellId, gueltigAb },
      });
    const teilzeit = await json(
      await jonas.anfrage("/api/v1/arbeitszeit/modelle", {
        body: {
          name: "Teilzeit",
          sollMinuten: [240, 240, 240, 240, 240, 0, 0],
          lohnArt: "monat",
          lohnCent: null,
          minijob: false,
          gueltigAb: "2026-01-01",
        },
      }),
    );
    const andere = (gueltigAb: string) =>
      jonas.anfrage(`/api/v1/arbeitszeit/personen/${sandra.nutzerId}/modell`, {
        method: "PUT",
        body: { modellId: teilzeit.modellId, gueltigAb },
      });
    await abgelehnt(await andere("2026-10-15"));
    await abgelehnt(await andere("2026-10-01"));
    // before October it holds only until the assignment of 1 October: October stays as it is
    expect((await andere("2026-09-01")).status).toBe(200);
    expect((await andere("2026-11-01")).status).toBe(200);
    // the same model on the same day again changes nothing
    expect((await zuordnen("2026-10-01")).status).toBe(200);
  });
});

describe("a correction after closing", () => {
  it("is a counter-entry with a reason that leaves the closed rows and the Prüfwert as they are", async () => {
    const { server, jonas, anna, sandra, pruefwert } = await abgeschlossen();
    const stempelVorher = server.sqlite
      .query("SELECT * FROM stempelungen ORDER BY stempel_id")
      .all();
    const eintrag = (wer: Person, body: Json) =>
      wer.anfrage("/api/v1/arbeitszeit/monat/gegeneintrag", { body });
    const ohneGrund = await eintrag(anna, {
      nutzerId: sandra.nutzerId,
      tag: "2026-10-06",
      minuten: 30,
    });
    expect(ohneGrund.status).toBe(400);
    expect(
      (
        await eintrag(sandra, {
          nutzerId: sandra.nutzerId,
          tag: "2026-10-06",
          minuten: 30,
          grund: "x",
        })
      ).status,
    ).toBe(403);
    const antwort = await eintrag(anna, {
      nutzerId: sandra.nutzerId,
      tag: "2026-10-06",
      minuten: 30,
      grund: "Rüstzeit vergessen",
    });
    expect(antwort.status).toBe(201);
    expect(server.sqlite.query("SELECT * FROM stempelungen ORDER BY stempel_id").all()).toEqual(
      stempelVorher,
    );
    expect(await pruefen(server, jonas.betriebId, pruefwert)).toMatchObject({
      ergebnis: "uebereinstimmend",
      gegeneintraege: [{ tag: "2026-10-06", minuten: 30, grund: "Rüstzeit vergessen", am: JETZT }],
    });
    // counted in the month it was entered in
    const november = await json(await sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-11"));
    expect((november.inhalt as Json).gegeneintraege).toEqual([
      { tag: "2026-10-06", minuten: 30, grund: "Rüstzeit vergessen" },
    ]);
    expect(kettePruefen(server.db, jonas.betriebId)).toEqual([]);
  });

  it("is refused for a day of an open month: that is corrected on its stamps", async () => {
    const { anna, sandra } = await weber();
    const antwort = await anna.anfrage("/api/v1/arbeitszeit/monat/gegeneintrag", {
      body: { nutzerId: sandra.nutzerId, tag: "2026-10-06", minuten: 30, grund: "x" },
    });
    expect(antwort.status).toBe(409);
    expect(await json(antwort)).toEqual({ fehler: "offen" });
  });
});

describe("the time sheet", () => {
  it("downloads as a PDF with days, sums, findings and the Prüfwert", async () => {
    const { sandra, pruefwert } = await abgeschlossen();
    const antwort = await sandra.anfrage("/api/v1/arbeitszeit/monat/stundenzettel?monat=2026-10");
    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("content-type")).toBe("application/pdf");
    expect(antwort.headers.get("content-disposition")).toContain("stundenzettel-2026-10.pdf");
    const text = pdfText(new Uint8Array(await antwort.arrayBuffer()));
    expect(text).toContain("Stundenzettel Oktober 2026");
    expect(text).toContain("sandra · Weber Haustechnik");
    expect(text).toContain("Di 06.10.");
    expect(text).toContain("Soll 176:00 · Ist 14:00 · Saldo -162:00");
    expect(text).toContain(pruefwert);
    expect(text).toContain("/pruefen?betrieb=");
  });

  it("is a draft without Prüfwert while the month is open", async () => {
    const { sandra } = await weber();
    const antwort = await sandra.anfrage("/api/v1/arbeitszeit/monat/stundenzettel?monat=2026-10");
    const text = pdfText(new Uint8Array(await antwort.arrayBuffer()));
    expect(text).toContain("Entwurf: Monat noch nicht abgeschlossen");
  });

  it("goes to the person by mail when the month is closed (SMTP test server)", async () => {
    const smtp = await smtpTestServer();
    const w = await weber({ mail: smtpMailer(smtp.url, "Soll <soll@weber.test>") });
    await w.tag(w.jonas, [
      ["kommen", "2026-10-07T07:00:00+02:00"],
      ["gehen", "2026-10-07T12:00:00+02:00"],
    ]);
    await bestaetigen(w.jonas);
    const antwort = await json(await abschliessen(w.jonas, w.jonas.nutzerId));
    expect(antwort.mail).toBe("gesendet");
    expect(smtp.empfangen).toHaveLength(1);
    const [mail] = smtp.empfangen;
    expect(mail?.an).toEqual(["weber@betrieb.test"]);
    expect(mail?.betreff).toBe("Dein Stundenzettel Oktober 2026 · Weber Haustechnik");
    const pruefwert = (antwort.abschluss as Json).pruefwert as string;
    expect(mail?.text).toContain(`Prüfwert: ${pruefwert}`);
    expect(mail?.anhaenge[0]?.name).toBe("stundenzettel-2026-10.pdf");
    expect(pdfText(new Uint8Array(mail?.anhaenge[0]?.inhalt ?? []))).toContain(pruefwert);
    // Sandra was invited without an e-mail address: nothing to send, the download stays
    await bestaetigen(w.sandra);
    expect((await json(await abschliessen(w.jonas, w.sandra.nutzerId))).mail).toBe("keine_adresse");
    expect(smtp.empfangen).toHaveLength(1);
  });
});
