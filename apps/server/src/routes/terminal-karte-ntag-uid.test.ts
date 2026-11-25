import { describe, expect, it } from "vitest";
import { karteEintragen, NTAG_SCHLUESSEL, NTAG_UID } from "./karten-testhilfen.ts";
import { betriebMitTerminal, neuerServer } from "./terminal-testhilfen.ts";

/**
 * An NTAG 424 DNA mirrors its UID in the PICCData only with PICCDataTag C7, a UID of 7 bytes
 * (NXP AN12196, section 3.4; sun.ts): a card entered with another length could never be recognised,
 * and each of its taps would count toward the terminal's lock
 */
describe("the UID of an NTAG 424 DNA (S-802)", { timeout: 20_000 }, () => {
  it.each([
    ["4 bytes", "04A1B2C3"],
    ["10 bytes", "04A1B2C3D4E5F60718A9"],
  ])("refuses one of %s (400)", async (_, uid) => {
    const server = neuerServer();
    const { inhaber, mitarbeiterin: lea } = await betriebMitTerminal(server);
    const antwort = await karteEintragen(inhaber, {
      nutzerId: lea.nutzerId,
      art: "ntag424",
      uid,
      ...NTAG_SCHLUESSEL,
    });
    expect(antwort.status).toBe(400);
  });

  it("takes one of 7 bytes, and a plain card of 4 or 10", async () => {
    const server = neuerServer();
    const { inhaber, mitarbeiterin: lea } = await betriebMitTerminal(server);
    const ntag = await karteEintragen(inhaber, {
      nutzerId: lea.nutzerId,
      art: "ntag424",
      uid: NTAG_UID,
      ...NTAG_SCHLUESSEL,
    });
    expect(ntag.status).toBe(201);
    for (const uid of ["04A1B2C3", "04A1B2C3D4E5F60718A9"]) {
      const einfach = await karteEintragen(inhaber, { nutzerId: lea.nutzerId, art: "uid", uid });
      expect(einfach.status).toBe(201);
    }
  });
});
