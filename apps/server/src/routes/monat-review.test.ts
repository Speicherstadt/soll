/** Cases found in the independent review of S-306 */
import { pdfText } from "@soll/export";
import { describe, expect, it } from "vitest";
import { smtpMailer } from "../modules/mail/index.ts";
import { smtpTestServer } from "../modules/mail/smtp-test.ts";
import {
  abschliessen,
  bestaetigen,
  type Json,
  json,
  nachtrag,
  pruefen,
  um,
  weber,
} from "./monat-testhilfen.ts";

const abgelehnt = async (antwort: Response) => {
  expect(antwort.status).toBe(409);
  expect(await json(antwort)).toEqual({ fehler: "abgeschlossen" });
};

describe("the last day before a closed month", () => {
  it("refuses removing the Kommen of a night shift whose Gehen lies in the closed month", async () => {
    const w = await weber();
    const [kommen] = await w.tag(w.sandra, [
      ["kommen", "2026-09-30T22:00:00+02:00"],
      ["gehen", "2026-10-01T05:00:00+02:00"],
    ]);
    await bestaetigen(w.sandra);
    const antwort = await abschliessen(w.jonas, w.sandra.nutzerId);
    expect(antwort.status).toBe(201);
    const pruefwert = ((await json(antwort)).abschluss as Json).pruefwert as string;
    // September is open, but without its Kommen the Gehen becomes a stamp of 1 October
    await abgelehnt(
      await w.jonas.anfrage(`/api/v1/arbeitszeit/stempelungen/${kommen}/entfernen`, {
        body: { grund: "x" },
      }),
    );
    expect(await pruefen(w.server, w.jonas.betriebId, pruefwert)).toMatchObject({
      ergebnis: "uebereinstimmend",
    });
  });

  it("refuses a shift on 30 September that the first shift of the closed October would join", async () => {
    const w = await weber();
    await w.tag(w.sandra, [
      ["kommen", "2026-10-01T06:00:00+02:00"],
      ["gehen", "2026-10-01T14:00:00+02:00"],
    ]);
    await bestaetigen(w.sandra);
    const antwort = await abschliessen(w.jonas, w.sandra.nutzerId);
    expect(antwort.status).toBe(201);
    const pruefwert = ((await json(antwort)).abschluss as Json).pruefwert as string;
    // less than 9 h before the Kommen of 1 October: that shift would begin on 30 September
    for (const [art, zeit] of [
      ["kommen", "2026-09-30T22:00:00+02:00"],
      ["gehen", "2026-09-30T23:00:00+02:00"],
    ] as const)
      await nachtrag(w.sandra, { art, zeitpunkt: um(zeit), grund: "x" });
    expect(await pruefen(w.server, w.jonas.betriebId, pruefwert)).toMatchObject({
      ergebnis: "uebereinstimmend",
    });
    // a September day that does not touch October stays open
    expect(
      (
        await nachtrag(w.sandra, {
          art: "kommen",
          zeitpunkt: um("2026-09-29T08:00:00+02:00"),
          grund: "x",
        })
      ).status,
    ).toBe(201);
  });
});

describe("a counter-entry", () => {
  it("counts in the Ist and the balance of the month it is entered in", async () => {
    const w = await weber();
    await bestaetigen(w.sandra);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
    const summen = async () =>
      (
        (await json(await w.sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-11")))
          .inhalt as Json
      ).summen as Json;
    const vorher = await summen();
    expect(
      (
        await w.anna.anfrage("/api/v1/arbeitszeit/monat/gegeneintrag", {
          body: { nutzerId: w.sandra.nutzerId, tag: "2026-10-06", minuten: 30, grund: "Rüstzeit" },
        })
      ).status,
    ).toBe(201);
    const nachher = await summen();
    expect(nachher.istMinuten).toBe((vorher.istMinuten as number) + 30);
    expect(nachher.saldoMinuten).toBe((vorher.saldoMinuten as number) + 30);
  });
});

describe("the time sheet of a name outside WinAnsi", () => {
  it("is closed, mailed and downloaded for Cyrillic and Arabic names", async () => {
    const smtp = await smtpTestServer();
    const w = await weber({ mail: smtpMailer(smtp.url, "Soll <soll@weber.test>") });
    const umbenennen = (nutzerId: string, name: string) =>
      w.server.sqlite.query("UPDATE user SET name = ? WHERE id = ?").run(name, nutzerId);
    umbenennen(w.sandra.nutzerId, "Олена Коваль");
    umbenennen(w.jonas.nutzerId, "يوسف 😀");
    await bestaetigen(w.sandra);
    const antwort = await abschliessen(w.jonas, w.sandra.nutzerId, { grund: "مرض\nlange" });
    expect(antwort.status).toBe(201);
    const pdf = await w.sandra.anfrage("/api/v1/arbeitszeit/monat/stundenzettel?monat=2026-10");
    expect(pdf.status).toBe(200);
    const text = pdfText(new Uint8Array(await pdf.arrayBuffer()));
    expect(text).toContain("Stundenzettel Oktober 2026");
    expect(text).toContain("????? ?????? · Weber Haustechnik");
    // the owner with an address gets his sheet by mail, his name in the text as it is
    await bestaetigen(w.jonas);
    expect((await json(await abschliessen(w.jonas, w.jonas.nutzerId))).mail).toBe("gesendet");
    expect(smtp.empfangen[0]?.text).toContain("Hallo يوسف 😀,");
  });
});

describe("closing with a stamp without Kommen", () => {
  it("is not held up as an open shift: no shift is open", async () => {
    const w = await weber();
    await w.tag(w.sandra, [["gehen", "2026-10-01T05:00:00+02:00"]]);
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
  });
});

/* Second round of the independent review */

const korrigieren = (w: Awaited<ReturnType<typeof weber>>, stempelId: string, zeit: string) =>
  w.jonas.anfrage(`/api/v1/arbeitszeit/stempelungen/${stempelId}`, {
    method: "PATCH",
    body: { art: "gehen", zeitpunkt: um(zeit), grund: "x" },
  });

describe("the lock around a closed month, second round", () => {
  it("allows a change on the 2nd and a new shift on the 1st that do not touch the closed month", async () => {
    const w = await weber();
    await bestaetigen(w.sandra);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
    for (const [art, zeit] of [
      ["kommen", "2026-11-01T12:00:00+01:00"],
      ["gehen", "2026-11-01T16:00:00+01:00"],
      ["kommen", "2026-11-02T08:00:00+01:00"],
    ] as const)
      expect((await nachtrag(w.sandra, { art, zeitpunkt: um(zeit), grund: "x" })).status).toBe(201);
  });

  it("refuses moving the Gehen on 1 November of the night shift of the closed 31 October", async () => {
    const w = await weber();
    await bestaetigen(w.sandra);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId)).status).toBe(201);
    await abgelehnt(await korrigieren(w, w.ids.nachtGehen, "2026-11-01T03:00:00+01:00"));
  });

  it("allows correcting the Gehen in the closed October of a night shift of the open 30 September", async () => {
    const w = await weber();
    const [, gehen] = await w.tag(w.sandra, [
      ["kommen", "2026-09-30T22:00:00+02:00"],
      ["gehen", "2026-10-01T05:00:00+02:00"],
    ]);
    await bestaetigen(w.sandra);
    const antwort = await abschliessen(w.jonas, w.sandra.nutzerId);
    expect(antwort.status).toBe(201);
    const pruefwert = ((await json(antwort)).abschluss as Json).pruefwert as string;
    // the shift and its Gehen belong to 30 September, which is open; October keeps its stamps
    expect((await korrigieren(w, gehen ?? "", "2026-10-01T06:00:00+02:00")).status).toBe(201);
    expect(await pruefen(w.server, w.jonas.betriebId, pruefwert)).toMatchObject({
      ergebnis: "uebereinstimmend",
    });
  });

  it("allows correcting the night shift of an open October whose Gehen lies in a closed November", async () => {
    const w = await weber();
    w.server.stelleUhr(um("2026-12-03T09:00:00+01:00"));
    await bestaetigen(w.sandra, "2026-11");
    const antwort = await w.jonas.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat: "2026-11", nutzerId: w.sandra.nutzerId },
    });
    expect(antwort.status).toBe(201);
    const pruefwert = ((await json(antwort)).abschluss as Json).pruefwert as string;
    // 31 October is open; a counter-entry is only for closed days, so the stamp is the way
    expect((await korrigieren(w, w.ids.nachtGehen, "2026-11-01T03:00:00+01:00")).status).toBe(201);
    expect(await pruefen(w.server, w.jonas.betriebId, pruefwert)).toMatchObject({
      ergebnis: "uebereinstimmend",
    });
    // a shift of its own on 1 November is still refused
    await abgelehnt(
      await nachtrag(w.sandra, {
        art: "kommen",
        zeitpunkt: um("2026-11-01T14:00:00+01:00"),
        grund: "x",
      }),
    );
  });
});

describe("a day with a stamp out of order, second round", () => {
  it("shows a Gehen without Kommen with its R-01 finding on the closed month", async () => {
    const w = await weber();
    await w.tag(w.sandra, [["gehen", "2026-10-14T17:00:00+02:00"]]);
    await bestaetigen(w.sandra);
    const inhalt = (await json(await abschliessen(w.jonas, w.sandra.nutzerId))).inhalt as Json;
    const tage = inhalt.tage as { tag: string; stempel: unknown[] }[];
    expect(tage.find((tag) => tag.tag === "2026-10-14")?.stempel).toHaveLength(1);
    expect(inhalt.befunde).toContainEqual(
      expect.objectContaining({ regel: "R-01", tage: ["2026-10-14"] }),
    );
  });

  it("still holds up closing for a forgotten Gehen of an earlier day", async () => {
    const w = await weber();
    await w.tag(w.sandra, [["kommen", "2026-10-14T08:00:00+02:00"]]);
    await bestaetigen(w.sandra);
    const antwort = await abschliessen(w.jonas, w.sandra.nutzerId);
    expect(antwort.status).toBe(409);
    expect(await json(antwort)).toEqual({ fehler: "offene_schicht" });
  });
});

describe("a counter-entry, second round", () => {
  it("stays out of the closed month, and the month it is booked in closes with it", async () => {
    const w = await weber();
    await bestaetigen(w.sandra);
    const oktober = await json(await abschliessen(w.jonas, w.sandra.nutzerId));
    const pruefwertOktober = (oktober.abschluss as Json).pruefwert as string;
    await w.anna.anfrage("/api/v1/arbeitszeit/monat/gegeneintrag", {
      body: { nutzerId: w.sandra.nutzerId, tag: "2026-10-06", minuten: 30, grund: "Rüstzeit" },
    });
    const okt = await json(await w.sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-10"));
    expect(okt.inhalt).toEqual(oktober.inhalt);
    w.server.stelleUhr(um("2026-12-03T09:00:00+01:00"));
    expect((await bestaetigen(w.sandra, "2026-11")).status).toBe(201);
    const november = await w.jonas.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat: "2026-11", nutzerId: w.sandra.nutzerId },
    });
    expect(november.status).toBe(201);
    const daten = await json(november);
    const inhalt = daten.inhalt as Json;
    expect(inhalt.gegeneintraege).toEqual([{ tag: "2026-10-06", minuten: 30, grund: "Rüstzeit" }]);
    expect((inhalt.summen as Json).istMinuten).toBe(30);
    const pdf = await w.sandra.anfrage("/api/v1/arbeitszeit/monat/stundenzettel?monat=2026-11");
    const text = pdfText(new Uint8Array(await pdf.arrayBuffer()));
    expect(text).toContain("Rüstzeit");
    for (const pruefwert of [pruefwertOktober, (daten.abschluss as Json).pruefwert as string])
      expect(await pruefen(w.server, w.jonas.betriebId, pruefwert)).toMatchObject({
        ergebnis: "uebereinstimmend",
      });
  });
});
