import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { json } from "./projektzeit-testhilfen.ts";
import { stand, starten, stoppen, um, werkstatt } from "./stoppuhr-testhilfen.ts";

describe("the stopwatch (S-602)", () => {
  it("starts on the minute, runs, and stops with whole minutes through the audit chain", async () => {
    const { server, weber, sandra, projekt, montage } = await werkstatt();
    server.stelleUhr(um("07:00") + 42_000);
    const start = await starten(sandra, {
      projektId: projekt.projektId,
      taetigkeitId: montage.taetigkeitId,
      notiz: "Vorwand",
    });
    expect(start.status).toBe(201);
    expect(await json(start)).toMatchObject({
      laufend: {
        nutzerId: sandra.nutzerId,
        projektId: projekt.projektId,
        taetigkeitId: montage.taetigkeitId,
        beginn: um("07:00"),
        ende: null,
        tag: "2026-11-20",
        notiz: "Vorwand",
        abgerechnetAm: null,
      },
      beendet: null,
    });
    server.stelleUhr(um("08:30") + 59_000);
    expect((await stand(sandra)).laufend).toMatchObject({ beginn: um("07:00"), minuten: 90 });
    const stopp = await stoppen(sandra);
    expect(stopp.status).toBe(200);
    expect(await json(stopp)).toMatchObject({ beendet: { ende: um("08:30"), minuten: 90 } });
    const tag = await stand(sandra);
    expect(tag.laufend).toBeNull();
    expect(tag.buchungen).toEqual([expect.objectContaining({ minuten: 90 })]);
    expect(kettePruefen(server.db, weber.betriebId)).toEqual([]);
  });

  it("switches in one tap: the running booking ends where the next begins", async () => {
    const { server, sandra, projekt, montage } = await werkstatt();
    await starten(sandra, { projektId: projekt.projektId, taetigkeitId: montage.taetigkeitId });
    server.stelleUhr(um("09:15") + 10_000);
    const wechsel = await starten(sandra, { projektId: null, taetigkeitId: "fahrt" });
    expect(wechsel.status).toBe(201);
    const { laufend, beendet } = await json(wechsel);
    expect(beendet).toMatchObject({ taetigkeitId: montage.taetigkeitId, ende: um("09:15") });
    expect(laufend).toMatchObject({ projektId: null, taetigkeitId: "fahrt", beginn: um("09:15") });
    server.stelleUhr(um("09:45"));
    const tag = await stand(sandra);
    expect(tag.buchungen).toEqual([
      expect.objectContaining({ minuten: 135, ende: um("09:15") }),
      expect.objectContaining({ minuten: 30, ende: null }),
    ]);
  });

  it("keeps one running stopwatch per person, also for two taps at once", async () => {
    const { server, sandra, projekt, montage } = await werkstatt();
    const body = (taetigkeitId: string) => ({ projektId: projekt.projektId, taetigkeitId });
    const antworten = await Promise.all([
      starten(sandra, body(montage.taetigkeitId)),
      starten(sandra, body("fahrt")),
    ]);
    expect(antworten.every((antwort) => antwort.status < 300)).toBe(true);
    server.stelleUhr(um("08:00"));
    const tag = await stand(sandra);
    expect(
      (tag.buchungen as { ende: number | null }[]).filter((b) => b.ende === null),
    ).toHaveLength(1);
  });

  it("leaves the running booking as it is when the same order and activity are tapped again", async () => {
    const { server, sandra, projekt, montage } = await werkstatt();
    const body = { projektId: projekt.projektId, taetigkeitId: montage.taetigkeitId };
    const erste = await json(await starten(sandra, body));
    server.stelleUhr(um("08:00"));
    const nochmal = await starten(sandra, body);
    expect(nochmal.status).toBe(200);
    const { buchungId } = erste.laufend as { buchungId: string };
    expect(await json(nochmal)).toMatchObject({
      laufend: { buchungId, minuten: 60 },
      beendet: null,
    });
  });

  it("books nothing for a stopwatch stopped or switched within its first minute", async () => {
    const { server, sandra, projekt, montage } = await werkstatt();
    await starten(sandra, { projektId: projekt.projektId, taetigkeitId: montage.taetigkeitId });
    server.stelleUhr(um("07:00") + 50_000);
    const wechsel = await json(await starten(sandra, { projektId: null, taetigkeitId: "lager" }));
    expect(wechsel.beendet).toBeNull();
    expect(wechsel.laufend).toMatchObject({ taetigkeitId: "lager", beginn: um("07:00") });
    expect(await json(await stoppen(sandra))).toEqual({ beendet: null });
    expect((await stand(sandra)).buchungen).toEqual([]);
  });

  it("answers 409 to a stop without a running stopwatch", async () => {
    const { sandra } = await werkstatt();
    const stopp = await stoppen(sandra);
    expect(stopp.status).toBe(409);
    expect(await json(stopp)).toEqual({ fehler: "laeuft_nicht" });
  });

  it("refuses an unknown or archived order or activity", async () => {
    const { weber, sandra, projekt, montage, kunde } = await werkstatt();
    const versuch = async (body: Record<string, unknown>) => {
      const antwort = await starten(sandra, body);
      return [antwort.status, await json(antwort)];
    };
    expect(await versuch({ projektId: "nichts", taetigkeitId: "fahrt" })).toEqual([
      422,
      { fehler: "projekt_unbekannt" },
    ]);
    expect(await versuch({ projektId: null, taetigkeitId: "nichts" })).toEqual([
      422,
      { fehler: "taetigkeit_unbekannt" },
    ]);
    const pz = "/api/v1/projektzeit";
    await weber.anfrage(`${pz}/taetigkeiten/${montage.taetigkeitId}`, {
      method: "PATCH",
      body: { archiviert: true },
    });
    expect(await versuch({ projektId: null, taetigkeitId: montage.taetigkeitId })).toEqual([
      409,
      { fehler: "archiviert" },
    ]);
    await weber.anfrage(`${pz}/kunden/${kunde.kundeId}`, {
      method: "PATCH",
      body: { archiviert: true },
    });
    expect(await versuch({ projektId: projekt.projektId, taetigkeitId: "fahrt" })).toEqual([
      409,
      { fehler: "archiviert" },
    ]);
    expect(await versuch({ taetigkeitId: "fahrt", extra: 1 })).toEqual([
      400,
      { fehler: "ungueltig" },
    ]);
  });

  it("is for whoever books project time: not for a device", async () => {
    const { server, weber } = await werkstatt();
    const tablet = await server.eingeladen(weber, "geraet", "tablet");
    expect((await starten(tablet, { projektId: null, taetigkeitId: "fahrt" })).status).toBe(403);
    expect((await tablet.anfrage("/api/v1/projektzeit/stoppuhr")).status).toBe(403);
  });

  it("offers the order and activity booked last for a switch in one tap", async () => {
    const { server, sandra, projekt, montage } = await werkstatt();
    await starten(sandra, { projektId: projekt.projektId, taetigkeitId: montage.taetigkeitId });
    server.stelleUhr(um("08:00"));
    await starten(sandra, { projektId: null, taetigkeitId: "fahrt" });
    server.stelleUhr(um("08:30"));
    await starten(sandra, { projektId: projekt.projektId, taetigkeitId: montage.taetigkeitId });
    expect((await stand(sandra)).zuletzt).toEqual([
      { projektId: projekt.projektId, taetigkeitId: montage.taetigkeitId },
      { projektId: null, taetigkeitId: "fahrt" },
    ]);
  });
});
