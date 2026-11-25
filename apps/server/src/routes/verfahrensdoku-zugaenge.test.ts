import { describe, expect, it } from "vitest";
import { type Doku, text, weber } from "./verfahrensdoku-testhilfen.ts";
import { mitgliedId, tokenVon } from "./zugaenge-testhilfen.ts";

/** Review of S-902: the document counts only API tokens that would work (zugang-anmeldung.ts) */

const zugaenge = async (jonas: Awaited<ReturnType<typeof weber>>["jonas"]) => {
  const { dokument } = (await (await jonas.anfrage("/api/v1/verfahrensdoku")).json()) as Doku;
  return text(dokument);
};

describe("API tokens in the Verfahrensdokumentation", () => {
  it("counts the token of a member", async () => {
    const { jonas, sandra } = await weber();
    await tokenVon(sandra);
    expect(await zugaenge(jonas)).toContain("Gültig sind 1 Zugang.");
  });

  it("does not count the token of a person who left as valid", async () => {
    const { jonas, sandra } = await weber();
    await tokenVon(sandra);
    const weg = await jonas.anfrage("/api/auth/organization/remove-member", {
      body: {
        memberIdOrEmail: await mitgliedId(jonas, sandra.nutzerId),
        organizationId: jonas.betriebId,
      },
    });
    expect(weg.status).toBe(200);
    expect(await zugaenge(jonas)).toContain("Gültige API-Zugänge für Programme gibt es nicht.");
  });

  it("does not count a token made before the person's current membership", async () => {
    const { server, jonas, sandra } = await weber();
    await tokenVon(sandra);
    // as if Sandra had left and joined again after the token was made
    server.sqlite.query("UPDATE api_zugaenge SET angelegt_am = angelegt_am - 86400000").run();
    expect(await zugaenge(jonas)).toContain("Gültige API-Zugänge für Programme gibt es nicht.");
  });
});
