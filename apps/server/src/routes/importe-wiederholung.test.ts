import { describe, expect, it } from "vitest";
import { IMP, koerper, uebernehmen, weberZumUmzug, zuordnungFuer } from "./importe-testhilfen.ts";
import { json } from "./projektzeit-testhilfen.ts";

const HEAD = "Typ;Kennung;Person;Datum;Beginn;Ende;Pause;Bis;Art;Kunde;Name;Nummer";
const csv = (...z: string[]) => [HEAD, ...z, ""].join("\r\n");

describe("a record found again whose date moved in the old tool", () => {
  it("does not close a month the stamps in Soll do not fall into", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    const zuordnung = zuordnungFuer(sandra.nutzerId, max.nutzerId);
    await uebernehmen(
      weber,
      koerper(zuordnung, csv("zeit;z-1;Sandra;03.08.2026;7:00;15:30;30;;;;;")),
    );
    // the old tool moved z-1 to September; Soll keeps it in August
    const zweite = csv("zeit;z-1;Sandra;03.09.2026;7:00;15:30;30;;;;;");
    const probe = await json(
      await weber.anfrage(`${IMP}/probelauf`, { body: koerper(zuordnung, zweite, "2026-09") }),
    );
    expect(probe.monate).not.toContainEqual({ nutzerId: sandra.nutzerId, monat: "2026-09" });
  });

  it("does not close a month the absence in Soll does not fall into", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    const zuordnung = zuordnungFuer(sandra.nutzerId, max.nutzerId);
    await uebernehmen(
      weber,
      koerper(zuordnung, csv("abwesenheit;a-1;Sandra;03.08.2026;;;;07.08.2026;Urlaub;;;")),
    );
    const zweite = csv("abwesenheit;a-1;Sandra;03.08.2026;;;;07.09.2026;Urlaub;;;");
    const probe = await json(
      await weber.anfrage(`${IMP}/probelauf`, { body: koerper(zuordnung, zweite, "2026-09") }),
    );
    expect(probe.monate).not.toContainEqual({ nutzerId: sandra.nutzerId, monat: "2026-09" });
  });
});
