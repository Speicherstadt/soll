import { describe, expect, it } from "vitest";
import { AL, einstellen, json, MONAT, novemberBeiWeber, team } from "./auslastung-testhilfen.ts";
import { mitProjektzeit } from "./projektzeit-testhilfen.ts";

/** Weber's November beside Mia's café, which has project time and nobody with time in it */
const zwei = async () => {
  const weber = await novemberBeiWeber();
  const mia = await mitProjektzeit(weber.server, "Café Elbblick", "elbblick");
  return { ...weber, mia };
};

describe("no business sees another's utilisation or changes its setting (S-604)", () => {
  it("GET /auslastung counts one's own people only", async () => {
    const { mia } = await zwei();
    expect((await json(await team(mia))).team).toEqual({
      art: "zu_klein",
      personen: 0,
      mindestens: 3,
    });
  });

  it("GET /auslastung/personen and /ich list one's own only", async () => {
    const { weber, mia } = await zwei();
    await einstellen(weber, true);
    await einstellen(mia, true);
    expect((await json(await mia.anfrage(`${AL}/personen?monat=${MONAT}`))).personen).toEqual([]);
    expect((await json(await mia.anfrage(`${AL}/ich?monat=${MONAT}`))).eigene).toMatchObject({
      anwesendMinuten: 0,
      abrechenbarMinuten: 0,
    });
  });

  it("PUT /auslastung/einstellung changes one's own business only", async () => {
    const { weber, sandra, mia } = await zwei();
    expect((await einstellen(mia, true)).status).toBe(200);
    expect((await sandra.anfrage(`${AL}/ich?monat=${MONAT}`)).status).toBe(403);
    expect((await json(await weber.anfrage("/api/v1/betrieb"))).auswertungJePersonSeit).toBeNull();
    await einstellen(weber, true);
    await einstellen(mia, false);
    expect((await sandra.anfrage(`${AL}/ich?monat=${MONAT}`)).status).toBe(200);
  });
});
