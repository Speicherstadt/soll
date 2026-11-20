import { describe, expect, it } from "vitest";
import { dateiText, exportPfad, weberMitOktober } from "./datev-testhilfen.ts";
import { json, nachtrag, um } from "./monat-testhilfen.ts";

/* Findings of the independent review of S-308 (PR #35) */

type Welt = Awaited<ReturnType<typeof weberMitOktober>>;

const entfernen = async (w: Welt, nutzerId: string) => {
  const organisation = await json(
    await w.jonas.anfrage(
      `/api/auth/organization/get-full-organization?organizationId=${w.jonas.betriebId}`,
    ),
  );
  const mitglied = (organisation.members as { id: string; userId: string }[]).find(
    (m) => m.userId === nutzerId,
  );
  const weg = await w.jonas.anfrage("/api/auth/organization/remove-member", {
    body: { memberIdOrEmail: mitglied?.id, organizationId: w.jonas.betriebId },
  });
  expect(weg.status).toBe(200);
};

describe("personnel numbers", () => {
  it("refuses a number that payroll reads as one already given (7 and 07)", async () => {
    const w = await weberMitOktober();
    const antwort = await w.zuordnung({
      personalnummern: { [w.sandra.nutzerId]: "7", [w.anna.nutzerId]: "07" },
    });
    expect(antwort.status).toBe(409);
    expect(await json(antwort)).toEqual({ fehler: "doppelt" });
  });

  it("can be given to a person who left after the month was closed", async () => {
    const w = await weberMitOktober();
    await entfernen(w, w.sandra.nutzerId);
    expect((await w.zuordnung()).status).toBe(200);
    const antwort = await w.lohn.anfrage(exportPfad("2026-10", "lodas"));
    expect(antwort.status).toBe(200);
    expect(await dateiText(antwort)).toContain("1;01.10.2026;101;1000;1;12,00;");
  });
});

describe("a person who left before the month was closed", () => {
  it("keeps the export from being written instead of being left out silently", async () => {
    const w = await weberMitOktober();
    await w.zuordnen(w.anna.nutzerId);
    await w.zuordnung({
      personalnummern: { [w.sandra.nutzerId]: "101", [w.anna.nutzerId]: "102" },
    });
    // Anna worked in October, then left before her month was closed
    for (const [art, zeit] of [
      ["kommen", "2026-10-07T08:00:00+02:00"],
      ["gehen", "2026-10-07T12:00:00+02:00"],
    ] as const)
      expect((await nachtrag(w.anna, { art, zeitpunkt: um(zeit), grund: "Zettel" })).status).toBe(
        201,
      );
    await entfernen(w, w.anna.nutzerId);
    const antwort = await w.lohn.anfrage(exportPfad("2026-10", "lodas"));
    expect(antwort.status).toBe(409);
    expect((await json(antwort)).fehlend).toContainEqual(
      expect.objectContaining({ art: "monat_offen", nutzerId: w.anna.nutzerId }),
    );
  });
});
