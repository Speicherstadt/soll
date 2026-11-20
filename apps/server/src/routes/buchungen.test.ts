import { describe, expect, it } from "vitest";
import { json, PZ } from "./projektzeit-testhilfen.ts";
import { buchen, stand, starten, um, werkstatt } from "./stoppuhr-testhilfen.ts";

const montageVon = async () => {
  const w = await werkstatt();
  w.server.stelleUhr(um("16:00"));
  const buchung = await buchen(w.sandra, {
    projektId: w.projekt.projektId,
    taetigkeitId: w.montage.taetigkeitId,
    beginn: um("08:00"),
    ende: um("10:00"),
  });
  return { ...w, buchung };
};

describe("bookings by hand, changes and removal (S-602)", () => {
  it("adds a booking by hand on whole minutes, in the past, at most 24 hours long", async () => {
    const { sandra, projekt, montage, buchung } = await montageVon();
    expect(buchung).toMatchObject({ minuten: 120, tag: "2026-11-20", nutzerId: sandra.nutzerId });
    const versuch = async (beginn: number, ende: number) =>
      (
        await sandra.anfrage(`${PZ}/buchungen`, {
          body: { projektId: projekt.projektId, taetigkeitId: montage.taetigkeitId, beginn, ende },
        })
      ).status;
    // not on a whole minute
    expect(await versuch(um("11:00") + 1_000, um("12:00"))).toBe(400);
    // ends before it begins, ends after now (16:00), longer than 24 hours
    expect(await versuch(um("12:00"), um("11:00"))).toBe(422);
    expect(await versuch(um("15:00"), um("16:01"))).toBe(422);
    expect(await versuch(um("06:00", "2026-11-19"), um("06:01"))).toBe(422);
  });

  it("refuses a booking that overlaps another of the same person, not one that touches it", async () => {
    const { sandra, projekt, montage } = await montageVon();
    const body = (beginn: number, ende: number) => ({
      body: { projektId: projekt.projektId, taetigkeitId: montage.taetigkeitId, beginn, ende },
    });
    const ueber = await sandra.anfrage(`${PZ}/buchungen`, body(um("09:30"), um("11:00")));
    expect(ueber.status).toBe(409);
    expect(await json(ueber)).toEqual({ fehler: "ueberschneidung" });
    expect((await sandra.anfrage(`${PZ}/buchungen`, body(um("10:00"), um("11:00")))).status).toBe(
      201,
    );
    // a stopwatch started now (16:00) only touches a booking that ends at 16:00
    expect((await starten(sandra, { projektId: null, taetigkeitId: "fahrt" })).status).toBe(201);
    const nachLaufend = await sandra.anfrage(`${PZ}/buchungen`, body(um("15:30"), um("16:00")));
    expect(nachLaufend.status).toBe(201);
  });

  it("changes order, activity, times and note, and moves the working day with the begin", async () => {
    const { sandra, buchung } = await montageVon();
    const pfad = `${PZ}/buchungen/${buchung.buchungId}`;
    const geaendert = await sandra.anfrage(pfad, {
      method: "PATCH",
      body: { projektId: null, taetigkeitId: "werkstatt", notiz: "Rohre", beginn: um("07:30") },
    });
    expect(geaendert.status).toBe(200);
    expect(await json(geaendert)).toMatchObject({
      projektId: null,
      taetigkeitId: "werkstatt",
      notiz: "Rohre",
      beginn: um("07:30"),
      ende: um("10:00"),
      minuten: 150,
    });
    const gestern = await sandra.anfrage(pfad, {
      method: "PATCH",
      body: { beginn: um("20:00", "2026-11-19"), ende: um("21:00", "2026-11-19") },
    });
    expect(await json(gestern)).toMatchObject({ tag: "2026-11-19", minuten: 60 });
    expect((await sandra.anfrage(pfad, { method: "PATCH", body: {} })).status).toBe(400);
  });

  it("does not end a running booking by a change: that is the stop", async () => {
    const { server, sandra } = await werkstatt();
    const { laufend } = await json(
      await starten(sandra, { projektId: null, taetigkeitId: "lager" }),
    );
    server.stelleUhr(um("08:00"));
    const pfad = `${PZ}/buchungen/${(laufend as { buchungId: string }).buchungId}`;
    const ende = await sandra.anfrage(pfad, { method: "PATCH", body: { ende: um("07:30") } });
    expect(ende.status).toBe(409);
    expect(await json(ende)).toEqual({ fehler: "laeuft" });
    const notiz = await sandra.anfrage(pfad, { method: "PATCH", body: { notiz: "Inventur" } });
    expect(await json(notiz)).toMatchObject({ notiz: "Inventur", ende: null });
  });

  it("removes a booking; a second removal is 404", async () => {
    const { sandra, buchung } = await montageVon();
    const pfad = `${PZ}/buchungen/${buchung.buchungId}`;
    expect((await sandra.anfrage(pfad, { method: "DELETE" })).status).toBe(204);
    expect((await sandra.anfrage(pfad, { method: "DELETE" })).status).toBe(404);
    expect((await stand(sandra, "tag=2026-11-20")).buchungen).toEqual([]);
  });

  it("lets a person change only their own bookings; owner and planner change everyone's", async () => {
    const { server, weber, sandra, buchung, projekt, montage } = await montageVon();
    const max = await server.eingeladen(weber, "mitarbeiter", "max");
    const pfad = `${PZ}/buchungen/${buchung.buchungId}`;
    expect((await max.anfrage(pfad, { method: "PATCH", body: { notiz: "x" } })).status).toBe(404);
    expect((await max.anfrage(pfad, { method: "DELETE" })).status).toBe(404);
    expect((await stand(max, `nutzerId=${sandra.nutzerId}`)).fehler).toBe("keine_berechtigung");
    const fuerSandra = await max.anfrage(`${PZ}/buchungen`, {
      body: {
        nutzerId: sandra.nutzerId,
        projektId: null,
        taetigkeitId: "fahrt",
        beginn: um("12:00"),
        ende: um("13:00"),
      },
    });
    expect(fuerSandra.status).toBe(403);
    const anna = await server.eingeladen(weber, "planer", "anna");
    expect((await anna.anfrage(pfad, { method: "PATCH", body: { notiz: "Bad" } })).status).toBe(
      200,
    );
    const nachgetragen = await anna.anfrage(`${PZ}/buchungen`, {
      body: {
        nutzerId: sandra.nutzerId,
        projektId: projekt.projektId,
        taetigkeitId: montage.taetigkeitId,
        beginn: um("12:00"),
        ende: um("13:00"),
      },
    });
    expect(await json(nachgetragen)).toMatchObject({ nutzerId: sandra.nutzerId, minuten: 60 });
    const tag = await stand(anna, `nutzerId=${sandra.nutzerId}&tag=2026-11-20`);
    expect(tag.buchungen).toHaveLength(2);
    const tablet = await server.eingeladen(weber, "geraet", "tablet");
    const geraet = await anna.anfrage(`${PZ}/buchungen`, {
      body: {
        nutzerId: tablet.nutzerId,
        projektId: null,
        taetigkeitId: "fahrt",
        beginn: um("12:00"),
        ende: um("13:00"),
      },
    });
    expect(geraet.status).toBe(422);
    expect(await json(geraet)).toEqual({ fehler: "person_unbekannt" });
  });
});

describe("abgerechnet locks a booking (S-602)", () => {
  it("is set by owner and planner with the rate in force, and then refuses changes", async () => {
    const { weber, sandra, buchung, projekt } = await montageVon();
    await weber.anfrage(`${PZ}/saetze`, {
      body: { projektId: projekt.projektId, centProStunde: 7_500, gueltigAb: "2026-11-01" },
    });
    expect(
      (
        await sandra.anfrage(`${PZ}/buchungen/abrechnen`, {
          body: { buchungIds: [buchung.buchungId] },
        })
      ).status,
    ).toBe(403);
    const abgerechnet = await weber.anfrage(`${PZ}/buchungen/abrechnen`, {
      body: { buchungIds: [buchung.buchungId] },
    });
    expect(abgerechnet.status).toBe(200);
    expect(await json(abgerechnet)).toEqual({
      buchungen: [{ buchungId: buchung.buchungId, centProStunde: 7_500, betragCent: 15_000 }],
    });
    const pfad = `${PZ}/buchungen/${buchung.buchungId}`;
    for (const [person, init] of [
      [sandra, { method: "PATCH", body: { notiz: "x" } }],
      [weber, { method: "PATCH", body: { notiz: "x" } }],
      [sandra, { method: "DELETE" }],
      [weber, { method: "DELETE" }],
    ] as const) {
      const antwort = await person.anfrage(pfad, init);
      expect(antwort.status).toBe(409);
      expect(await json(antwort)).toEqual({ fehler: "abgerechnet" });
    }
    const nochmal = await weber.anfrage(`${PZ}/buchungen/abrechnen`, {
      body: { buchungIds: [buchung.buchungId] },
    });
    expect(nochmal.status).toBe(409);
    expect((await stand(sandra, "tag=2026-11-20")).buchungen).toEqual([
      expect.objectContaining({ abgerechnetAm: um("16:00") }),
    ]);
  });

  it("bills all named bookings or none: not a running one, not an unknown one", async () => {
    const { weber, sandra, buchung } = await montageVon();
    const { laufend } = await json(
      await starten(sandra, { projektId: null, taetigkeitId: "lager" }),
    );
    const laeuft = await weber.anfrage(`${PZ}/buchungen/abrechnen`, {
      body: { buchungIds: [buchung.buchungId, (laufend as { buchungId: string }).buchungId] },
    });
    expect(laeuft.status).toBe(409);
    expect(await json(laeuft)).toEqual({ fehler: "laeuft" });
    const unbekannt = await weber.anfrage(`${PZ}/buchungen/abrechnen`, {
      body: { buchungIds: [buchung.buchungId, "nichts"] },
    });
    expect(unbekannt.status).toBe(404);
    expect((await stand(sandra, "tag=2026-11-20")).buchungen).toEqual(
      expect.arrayContaining([expect.objectContaining({ abgerechnetAm: null })]),
    );
  });

  it("keeps a non-billable activity at no rate: nothing is billed for it", async () => {
    const { weber, sandra } = await werkstatt();
    const buchung = await buchen(sandra, {
      projektId: null,
      taetigkeitId: "lager",
      beginn: um("06:00"),
      ende: um("06:30"),
    });
    await weber.anfrage(`${PZ}/saetze`, {
      body: { centProStunde: 5_000, gueltigAb: "2026-01-01" },
    });
    const abgerechnet = await json(
      await weber.anfrage(`${PZ}/buchungen/abrechnen`, {
        body: { buchungIds: [buchung.buchungId] },
      }),
    );
    expect(abgerechnet.buchungen).toEqual([
      { buchungId: buchung.buchungId, centProStunde: null, betragCent: 0 },
    ]);
  });
});
