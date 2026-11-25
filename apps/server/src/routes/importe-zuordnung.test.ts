import { describe, expect, it } from "vitest";
import {
  IMP,
  koerper,
  uebernehmen,
  WEBER_CSV,
  weberZumUmzug,
  zuordnungFuer,
} from "./importe-testhilfen.ts";
import { json } from "./projektzeit-testhilfen.ts";

describe("a second import with another mapping (S-701)", () => {
  it("does not close a person's month for a record that is there already for someone else", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    // first run: the file's "Sandra" taken over for Sandra, nothing closed
    await uebernehmen(weber, koerper(zuordnungFuer(sandra.nutzerId, max.nutzerId)));
    // second run maps "Sandra" to Max and says September was closed in the old tool
    const zuordnung = zuordnungFuer(max.nutzerId, max.nutzerId);
    const probe = await json(
      await weber.anfrage(`${IMP}/probelauf`, { body: koerper(zuordnung, WEBER_CSV, "2026-09") }),
    );
    // Max has no record in September at all: his September must not be closed as taken over
    expect(probe.monate).not.toContainEqual({ nutzerId: max.nutzerId, monat: "2026-09" });
    // the records taken over for Sandra are reported with their line, not counted as there
    expect((probe.abgelehnt as { liste: unknown[] }).liste).toEqual([
      { art: "zeiten", zeile: 2, externalId: "z-1", grund: "zuordnung_abweichend" },
      { art: "zeiten", zeile: 3, externalId: "z-2", grund: "zuordnung_abweichend" },
      { art: "abwesenheiten", zeile: 7, externalId: "a-1", grund: "zuordnung_abweichend" },
    ]);
    const ergebnis = await uebernehmen(weber, koerper(zuordnung, WEBER_CSV, "2026-09"));
    expect(ergebnis.gesperrt).not.toContainEqual({ nutzerId: max.nutzerId, monat: "2026-09" });
  });
});
