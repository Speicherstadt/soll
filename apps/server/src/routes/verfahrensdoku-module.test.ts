import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";
import { type Doku, text } from "./verfahrensdoku-testhilfen.ts";

/** Review round 3 of S-902 */

const doku = async (module: Record<string, boolean>, mitPersonen: boolean) => {
  const server = testServer();
  const jonas = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
  if (mitPersonen) await server.eingeladen(jonas, "mitarbeiter", "sandra");
  await jonas.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: module });
  return text(((await (await jonas.anfrage("/api/v1/verfahrensdoku")).json()) as Doku).dokument);
};

describe("Verfahrensdokumentation by module (review round 3)", () => {
  it("describes the shift swap (S-504) while the shift plan is on: employees change who holds a published shift", async () => {
    const inhalt = await doku(
      { arbeitszeit: true, dienstplan: true, projektzeit: false, terminal: false },
      true,
    );
    expect(inhalt).toMatch(/[Tt]ausch/);
  });

  it("names no PIN check at the terminal while working time is off, as section 3 says it recognises nobody", async () => {
    const inhalt = await doku(
      { arbeitszeit: false, dienstplan: false, projektzeit: false, terminal: true },
      false,
    );
    expect(inhalt).toContain("erkennt der Server am Terminal niemanden");
    expect(inhalt).not.toContain("PINs am Terminal prüfen");
  });
});
