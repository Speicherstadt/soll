import { describe, expect, it } from "vitest";
import { json, PZ } from "./projektzeit-testhilfen.ts";
import { buchen, stand, starten, stempeln, stoppen, um, werkstatt } from "./stoppuhr-testhilfen.ts";

describe("the stopwatch and the stamps (S-602)", () => {
  it("names the Kommen of the shift a booking falls in, and no Kommen outside it", async () => {
    const { server, sandra, projekt, montage } = await werkstatt();
    const kommen = await stempeln(sandra, "kommen");
    await starten(sandra, { projektId: projekt.projektId, taetigkeitId: montage.taetigkeitId });
    server.stelleUhr(um("15:00"));
    await stoppen(sandra);
    await stempeln(sandra, "gehen");
    server.stelleUhr(um("16:00"));
    const nachher = await buchen(sandra, {
      projektId: null,
      taetigkeitId: "fahrt",
      beginn: um("15:30"),
      ende: um("15:45"),
    });
    expect(nachher.kommen).toBeNull();
    const tag = await stand(sandra, "tag=2026-11-20");
    expect(tag.buchungen).toEqual([
      expect.objectContaining({
        kommen: { stempelId: kommen.stempelId, zeitpunkt: um("07:00") },
        ende: um("15:00"),
      }),
      expect.objectContaining({ kommen: null, minuten: 15 }),
    ]);
  });

  it("puts a booking after midnight of a night shift on the day the shift starts", async () => {
    const { server, sandra } = await werkstatt();
    server.stelleUhr(um("22:00", "2026-11-19"));
    const kommen = await stempeln(sandra, "kommen");
    server.stelleUhr(um("01:30"));
    const start = await json(await starten(sandra, { projektId: null, taetigkeitId: "werkstatt" }));
    expect(start.laufend).toMatchObject({
      tag: "2026-11-19",
      kommen: { stempelId: kommen.stempelId, zeitpunkt: um("22:00", "2026-11-19") },
    });
    server.stelleUhr(um("02:30"));
    const tag = await stand(sandra);
    expect(tag.tag).toBe("2026-11-19");
    expect(tag.buchungen).toEqual([expect.objectContaining({ minuten: 60 })]);
    expect((await stand(sandra, "tag=2026-11-20")).buchungen).toEqual([]);
  });

  it("gives a hint with both sums when a day has more project time than stamped time", async () => {
    const { server, sandra, projekt, montage } = await werkstatt();
    await stempeln(sandra, "kommen");
    server.stelleUhr(um("09:00"));
    await stempeln(sandra, "gehen");
    server.stelleUhr(um("12:00"));
    await buchen(sandra, {
      projektId: projekt.projektId,
      taetigkeitId: montage.taetigkeitId,
      beginn: um("07:00"),
      ende: um("09:00"),
    });
    const passt = await stand(sandra, "tag=2026-11-20");
    expect(passt).toMatchObject({ gebuchtMinuten: 120, gestempeltMinuten: 120, hinweis: null });
    await buchen(sandra, {
      projektId: null,
      taetigkeitId: "fahrt",
      beginn: um("10:00"),
      ende: um("10:45"),
    });
    expect((await stand(sandra, "tag=2026-11-20")).hinweis).toEqual({
      art: "mehr_projektzeit",
      schwere: "hinweis",
      gebuchtMinuten: 165,
      gestempeltMinuten: 120,
      ueberMinuten: 45,
    });
  });

  it("counts a running stopwatch and a running shift up to now", async () => {
    const { server, sandra } = await werkstatt();
    await starten(sandra, { projektId: null, taetigkeitId: "lager" });
    server.stelleUhr(um("07:10"));
    await stempeln(sandra, "kommen");
    server.stelleUhr(um("08:00"));
    expect(await stand(sandra)).toMatchObject({
      gebuchtMinuten: 60,
      gestempeltMinuten: 50,
      hinweis: { ueberMinuten: 10 },
    });
  });

  it("gives no hint while the business does not record working time in Soll", async () => {
    const { server, sandra } = await werkstatt();
    server.stelleUhr(um("12:00"));
    await buchen(sandra, {
      projektId: null,
      taetigkeitId: "fahrt",
      beginn: um("10:00"),
      ende: um("10:45"),
    });
    expect((await stand(sandra)).hinweis).toMatchObject({ ueberMinuten: 45 });
    // a business without employees may switch working time off (solo, S-603)
    const ohne = await server.inhaberMitBetrieb("Solo", "solo");
    await ohne.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { projektzeit: true, arbeitszeit: false },
    });
    await buchen(ohne, {
      projektId: null,
      taetigkeitId: "fahrt",
      beginn: um("10:00"),
      ende: um("11:00"),
    });
    expect(await stand(ohne)).toMatchObject({
      gebuchtMinuten: 60,
      gestempeltMinuten: null,
      hinweis: null,
    });
  });

  it("keeps project time of a closed month open until it is billed (docs/plan.md)", async () => {
    const { server, weber, sandra } = await werkstatt();
    server.stelleUhr(um("10:00", "2026-10-15"));
    const buchung = await buchen(sandra, {
      projektId: null,
      taetigkeitId: "fahrt",
      beginn: um("08:00", "2026-10-15"),
      ende: um("09:00", "2026-10-15"),
    });
    server.stelleUhr(um("10:00", "2026-11-20"));
    const abschluss = await weber.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat: "2026-10", nutzerId: sandra.nutzerId, grund: "Test" },
    });
    expect(abschluss.status).toBeLessThan(300);
    const geaendert = await sandra.anfrage(`${PZ}/buchungen/${buchung.buchungId}`, {
      method: "PATCH",
      body: { notiz: "Baustelle" },
    });
    expect(geaendert.status).toBe(200);
  });
});
