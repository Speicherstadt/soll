import { describe, expect, it } from "vitest";
import { JETZT, type Json, json, weber } from "./monat-testhilfen.ts";

const betriebMitPlan = async () => {
  const w = await weber();
  await w.jonas.anfrage("/api/v1/betrieb/module", {
    method: "PATCH",
    body: { dienstplan: true },
  });
  const standorte = await json(await w.jonas.anfrage("/api/v1/standorte"));
  const standortId = ((standorte.standorte as Json[])[0]?.standortId as string) ?? "";
  const schichtAnlegen = async (body: Json) =>
    json(
      await w.jonas.anfrage("/api/v1/dienstplan/schichten", {
        body: { standortId, rolle: "Service", pauseMinuten: 0, ...body },
      }),
    );
  const veroeffentlichen = (tag: string) =>
    w.jonas.anfrage("/api/v1/dienstplan/veroeffentlichen", { body: { standortId, tag } });
  const quelleSetzen = (ab: string, quelle: "modell" | "plan") =>
    w.jonas.anfrage("/api/v1/arbeitszeit/sollquellen", { method: "PUT", body: { ab, quelle } });
  return { ...w, standortId, schichtAnlegen, veroeffentlichen, quelleSetzen };
};

describe("TDD review S-505: absences, leave account and R-27 use plan-based Soll", () => {
  it("charges leave on planned Saturday and not on unplanned Tuesday in abwesenheiten and konten", async () => {
    const { jonas, sandra, schichtAnlegen, veroeffentlichen, quelleSetzen } =
      await betriebMitPlan();
    await quelleSetzen("2026-10-01", "plan");

    // Published 6h shift on Saturday 2026-10-10 (0h in Sandra's Mo–Fr model); no shift on Tue 2026-10-06
    await schichtAnlegen({
      tag: "2026-10-10",
      beginnMinute: 10 * 60,
      endeMinute: 16 * 60,
      nutzerId: sandra.nutzerId,
    });
    expect((await veroeffentlichen("2026-10-10")).status).toBe(200);

    // Draft-only shift on Sunday 2026-10-11 must not count as a planned working day
    await schichtAnlegen({
      tag: "2026-10-11",
      beginnMinute: 10 * 60,
      endeMinute: 14 * 60,
      nutzerId: sandra.nutzerId,
    });

    // Request and approve leave on planned Saturday 2026-10-10
    const antragSa = await json(
      await sandra.anfrage("/api/v1/arbeitszeit/abwesenheiten/antrag", {
        body: { art: "urlaub", von: "2026-10-10", bis: "2026-10-10" },
      }),
    );
    expect(antragSa.urlaubHalbtage).toBe(2);

    // Open requests endpoint must also report 2 half days for the planned Saturday
    const offen = await json(await jonas.anfrage("/api/v1/arbeitszeit/abwesenheiten/offen"));
    expect((offen.antraege as Json[])[0]?.urlaubHalbtage).toBe(2);

    expect(
      (
        await jonas.anfrage(
          `/api/v1/arbeitszeit/abwesenheiten/${antragSa.abwesenheitId as string}/freigeben`,
          { body: {} },
        )
      ).status,
    ).toBe(200);

    // Request and approve leave on unplanned Tuesday 2026-10-06 (8h in model, 0h in published plan)
    // and on draft-only Sunday 2026-10-11 (0h in published plan)
    const antragDi = await json(
      await sandra.anfrage("/api/v1/arbeitszeit/abwesenheiten/antrag", {
        body: { art: "urlaub", von: "2026-10-06", bis: "2026-10-06" },
      }),
    );
    expect(antragDi.urlaubHalbtage).toBe(0);
    expect(
      (
        await jonas.anfrage(
          `/api/v1/arbeitszeit/abwesenheiten/${antragDi.abwesenheitId as string}/freigeben`,
          { body: {} },
        )
      ).status,
    ).toBe(200);

    const antragSo = await json(
      await sandra.anfrage("/api/v1/arbeitszeit/abwesenheiten/antrag", {
        body: { art: "urlaub", von: "2026-10-11", bis: "2026-10-11" },
      }),
    );
    expect(antragSo.urlaubHalbtage).toBe(0);

    // Abwesenheiten overview: only the planned Saturday counts (2 half days)
    const abw = await json(await sandra.anfrage("/api/v1/arbeitszeit/abwesenheiten?jahr=2026"));
    expect((abw.urlaub as Json).genommenHalbtage).toBe(2);

    // Leave account (Urlaubskonto) must agree with the month calculation: 2 half days taken
    const konten = await json(await sandra.anfrage("/api/v1/arbeitszeit/konten"));
    const urlaub = konten.urlaub as Json;
    expect(urlaub.ok).toBe(true);
    const topf2026 = (urlaub.toepfe as Json[]).find((t) => t.jahr === 2026);
    expect(topf2026?.genommenHalbtage).toBe(2);
  });

  it("computes urlaubHalbtage and kinderkrankstand for a person without a working-time model", async () => {
    const { server, jonas, schichtAnlegen, veroeffentlichen, quelleSetzen } =
      await betriebMitPlan();
    const tom = await server.eingeladen(jonas, "mitarbeiter", "tom");
    await quelleSetzen("2026-10-01", "plan");

    await schichtAnlegen({
      tag: "2026-10-05",
      beginnMinute: 9 * 60,
      endeMinute: 15 * 60,
      nutzerId: tom.nutzerId,
    });
    await schichtAnlegen({
      tag: "2026-10-07",
      beginnMinute: 9 * 60,
      endeMinute: 15 * 60,
      nutzerId: tom.nutzerId,
    });
    expect((await veroeffentlichen("2026-10-05")).status).toBe(200);

    // Leave request on planned Monday 2026-10-05: 2 half days, not null
    const antrag = await json(
      await tom.anfrage("/api/v1/arbeitszeit/abwesenheiten/antrag", {
        body: { art: "urlaub", von: "2026-10-05", bis: "2026-10-05" },
      }),
    );
    expect(antrag.urlaubHalbtage).toBe(2);

    // Kind krank on planned Wednesday 2026-10-07: counted as 1 day, not nicht_hinterlegt
    server.stelleUhr(Date.parse("2026-10-07T07:00:00+02:00"));
    expect(
      (
        await tom.anfrage("/api/v1/arbeitszeit/abwesenheiten/krank", {
          body: { art: "kind_krank", bis: "2026-10-07", kind: "K1" },
        })
      ).status,
    ).toBe(201);
    server.stelleUhr(JETZT);

    const abw = await json(await tom.anfrage("/api/v1/arbeitszeit/abwesenheiten?jahr=2026"));
    expect(abw.kinderkrank).toMatchObject({ ok: true, wert: { gesamt: 1 } });
  });

  it("uses published shifts as working days for the R-27 eAU certificate due date (§ 5 Abs. 1 Satz 2 EntgFG)", async () => {
    const { server, jonas, sandra, schichtAnlegen, veroeffentlichen, quelleSetzen } =
      await betriebMitPlan();
    await quelleSetzen("2026-10-01", "plan");

    // Published shift on Saturday 2026-10-10 (day 4 of sickness Wed 7 Oct – Sun 11 Oct)
    await schichtAnlegen({
      tag: "2026-10-10",
      beginnMinute: 10 * 60,
      endeMinute: 16 * 60,
      nutzerId: sandra.nutzerId,
    });
    expect((await veroeffentlichen("2026-10-10")).status).toBe(200);

    server.stelleUhr(Date.parse("2026-10-07T07:00:00+02:00"));
    const krank = await json(
      await sandra.anfrage("/api/v1/arbeitszeit/abwesenheiten/krank", {
        body: { art: "krank", bis: "2026-10-11" },
      }),
    );
    expect((krank.frist as Json).faelligAm).toBe("2026-10-10");

    // On Saturday 2026-10-10, the eAU reminder must already appear in /abwesenheiten/offen
    server.stelleUhr(Date.parse("2026-10-10T09:00:00+02:00"));
    const offen = await json(await jonas.anfrage("/api/v1/arbeitszeit/abwesenheiten/offen"));
    expect(offen.erinnerungen).toEqual([
      expect.objectContaining({ nutzerId: sandra.nutzerId, faelligAm: "2026-10-10" }),
    ]);
    server.stelleUhr(JETZT);
  });
});
