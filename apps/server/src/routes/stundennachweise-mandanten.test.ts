import { describe, expect, it } from "vitest";
import { anlegen, json, mitProjektzeit } from "./projektzeit-testhilfen.ts";
import {
  baustelle,
  SN,
  tageFrage,
  UNTERSCHRIFT,
  unterschreiben,
  vorschau,
} from "./stundennachweis-testhilfen.ts";

/** Weber with a report Sandra had signed; Mia's café with a customer and an order of its own */
const zwei = async () => {
  const w = await baustelle();
  const nachweis = await json(await unterschreiben(w.sandra, tageFrage(w.projekt.projektId)));
  const mia = await mitProjektzeit(w.server, "Café Elbblick", "elbblick");
  const kunde = await anlegen(mia, "/kunden", { name: "Hafenfest" });
  const fest = await anlegen(mia, "/projekte", { kundeId: kunde.kundeId, name: "Catering" });
  return { ...w, nachweis, mia, fest: fest.projektId as string };
};

describe("no business sees or signs another's reports or bookings (S-605)", () => {
  it("GET /stundennachweise lists one's own business only", async () => {
    const w = await zwei();
    expect((await json(await w.mia.anfrage(SN))).nachweise).toEqual([]);
    expect(((await json(await w.weber.anfrage(SN))).nachweise as unknown[]).length).toBe(1);
  });

  it("GET /stundennachweise/{id} and its PDF do not reach another's report", async () => {
    const w = await zwei();
    expect((await w.mia.anfrage(`${SN}/${w.nachweis.nachweisId}`)).status).toBe(404);
    expect((await w.mia.anfrage(`${SN}/${w.nachweis.nachweisId}/pdf`)).status).toBe(404);
  });

  it("GET /vorschau takes no order or person of another and shows none of its bookings", async () => {
    const w = await zwei();
    expect((await vorschau(w.mia, tageFrage(w.projekt.projektId))).status).toBe(422);
    const fremdePerson = await vorschau(w.mia, tageFrage(w.fest, { nutzerId: w.sandra.nutzerId }));
    expect(fremdePerson.status).toBe(422);
    const eigene = await json(await vorschau(w.mia, tageFrage(w.fest)));
    expect(eigene).toMatchObject({ zeilen: [], summeMinuten: 0, kunde: { name: "Hafenfest" } });
  });

  it("POST /stundennachweise takes no order or person of another and locks none of its bookings", async () => {
    const w = await zwei();
    const body = {
      ...tageFrage(w.projekt.projektId),
      stand: "0".repeat(64),
      unterzeichner: "Erika Elbhof",
      unterschrift: UNTERSCHRIFT,
    };
    expect((await w.mia.anfrage(SN, { body })).status).toBe(422);
    const fremdePerson = await w.mia.anfrage(SN, {
      body: { ...body, projektId: w.fest, nutzerId: w.sandra.nutzerId },
    });
    expect(fremdePerson.status).toBe(422);
    // Weber's report stays the only one, and Jonas's booking is still open
    const offen = await json(await vorschau(w.weber, tageFrage(w.projekt.projektId)));
    expect((offen.zeilen as { buchungId: string }[]).map((z) => z.buchungId)).toEqual([
      w.jonasFahrt.buchungId,
    ]);
    const nummer = await json(await unterschreiben(w.mia, tageFrage(w.fest)));
    expect(nummer).toEqual({ fehler: "leer" });
  });
});
