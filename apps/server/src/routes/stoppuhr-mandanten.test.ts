import { describe, expect, it } from "vitest";
import { json, mitProjektzeit, PZ } from "./projektzeit-testhilfen.ts";
import { buchen, stand, starten, stoppen, um, werkstatt } from "./stoppuhr-testhilfen.ts";

/** Weber with a booking of Sandra and a running stopwatch; Mia's café beside it */
const zwei = async () => {
  const w = await werkstatt();
  w.server.stelleUhr(um("12:00"));
  const buchung = await buchen(w.sandra, {
    projektId: w.projekt.projektId,
    taetigkeitId: w.montage.taetigkeitId,
    beginn: um("08:00"),
    ende: um("10:00"),
  });
  await starten(w.sandra, { projektId: null, taetigkeitId: "fahrt" });
  const mia = await mitProjektzeit(w.server, "Café Elbblick", "elbblick");
  return { ...w, buchung, mia };
};

const unveraendert = async (w: Awaited<ReturnType<typeof zwei>>) => {
  const tag = await stand(w.sandra, "tag=2026-11-20");
  expect(tag.buchungen).toEqual([
    expect.objectContaining({ buchungId: w.buchung.buchungId, notiz: "", abgerechnetAm: null }),
    expect.objectContaining({ taetigkeitId: "fahrt", ende: null }),
  ]);
};

describe("no business sees or changes another's bookings (S-602)", () => {
  it("GET /stoppuhr shows one's own business only, also with a person of another", async () => {
    const w = await zwei();
    const tag = await stand(w.mia, "tag=2026-11-20");
    expect(tag).toMatchObject({ laufend: null, buchungen: [], zuletzt: [] });
    const fremd = await w.mia.anfrage(`${PZ}/stoppuhr?nutzerId=${w.sandra.nutzerId}`);
    expect(fremd.status).toBe(404);
  });

  it("PATCH, DELETE and abrechnen do not reach another's bookings", async () => {
    const w = await zwei();
    const pfad = `${PZ}/buchungen/${w.buchung.buchungId}`;
    expect((await w.mia.anfrage(pfad, { method: "PATCH", body: { notiz: "x" } })).status).toBe(404);
    expect((await w.mia.anfrage(pfad, { method: "DELETE" })).status).toBe(404);
    const abrechnen = await w.mia.anfrage(`${PZ}/buchungen/abrechnen`, {
      body: { buchungIds: [w.buchung.buchungId] },
    });
    expect(abrechnen.status).toBe(404);
    await unveraendert(w);
  });

  it("POST /buchungen and the stopwatch take no order, activity or person of another", async () => {
    const w = await zwei();
    const fremdesProjekt = await w.mia.anfrage(`${PZ}/buchungen`, {
      body: {
        projektId: w.projekt.projektId,
        taetigkeitId: "fahrt",
        beginn: um("08:00"),
        ende: um("09:00"),
      },
    });
    expect(fremdesProjekt.status).toBe(422);
    const fremdeTaetigkeit = await starten(w.mia, {
      projektId: null,
      taetigkeitId: w.montage.taetigkeitId,
    });
    expect(fremdeTaetigkeit.status).toBe(422);
    const fremdePerson = await w.mia.anfrage(`${PZ}/buchungen`, {
      body: {
        nutzerId: w.sandra.nutzerId,
        projektId: null,
        taetigkeitId: "fahrt",
        beginn: um("08:00"),
        ende: um("09:00"),
      },
    });
    expect(fremdePerson.status).toBe(422);
    // Mia's own stopwatch is hers alone: stopping it leaves Sandra's running
    expect((await stoppen(w.mia)).status).toBe(409);
    await unveraendert(w);
  });

  it("refuses every route of the stopwatch while the module is off", async () => {
    const w = await zwei();
    await w.weber.anfrage("/api/v1/betrieb/module", {
      method: "PATCH",
      body: { projektzeit: false },
    });
    const aufrufe: [string, string, unknown][] = [
      ["GET", "/stoppuhr", undefined],
      ["POST", "/stoppuhr/start", { projektId: null, taetigkeitId: "fahrt" }],
      ["POST", "/stoppuhr/stopp", {}],
      ["POST", "/buchungen", { projektId: null, taetigkeitId: "fahrt", beginn: 0, ende: 60_000 }],
      ["PATCH", `/buchungen/${w.buchung.buchungId}`, { notiz: "x" }],
      ["DELETE", `/buchungen/${w.buchung.buchungId}`, undefined],
      ["POST", "/buchungen/abrechnen", { buchungIds: [w.buchung.buchungId] }],
    ];
    for (const [method, pfad, body] of aufrufe) {
      const antwort = await w.sandra.anfrage(`${PZ}${pfad}`, { method, body });
      expect(antwort.status, `${method} ${pfad}`).toBe(403);
      expect(await json(antwort)).toEqual({ fehler: "modul_aus", modul: "projektzeit" });
    }
  });
});
