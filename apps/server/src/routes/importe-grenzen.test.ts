import { describe, expect, it } from "vitest";
import {
  datei,
  IMP,
  koerper,
  uebernehmen,
  weberZumUmzug,
  zuordnungFuer,
} from "./importe-testhilfen.ts";
import { pruefen } from "./monat-testhilfen.ts";
import { json } from "./projektzeit-testhilfen.ts";

const KOPF = "Typ;Kennung;Person;Datum;Beginn;Ende;Pause;Bis;Art;Kunde;Name;Nummer";
const csv = (...zeilen: string[]) => [KOPF, ...zeilen, ""].join("\r\n");

describe("imports: closed months, Prüfwert and two at once (S-701)", () => {
  it("closes no month as taken over when nothing of it was taken over", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    // Sandra's 1 September is recorded in Soll already (entered by the owner)
    for (const [art, zeit] of [
      ["kommen", "2026-09-01T07:00:00+02:00"],
      ["gehen", "2026-09-01T15:00:00+02:00"],
    ] as const) {
      const a = await weber.anfrage("/api/v1/arbeitszeit/stempelungen/nachtrag", {
        body: { nutzerId: sandra.nutzerId, art, zeitpunkt: Date.parse(zeit), grund: "Zettel" },
      });
      expect(a.status).toBe(201);
    }
    // the file's only September time overlaps it and is refused
    const text = csv("zeit;z-1;Sandra;01.09.2026;7:00;15:30;30;;;;;");
    const ergebnis = await uebernehmen(
      weber,
      koerper(zuordnungFuer(sandra.nutzerId, max.nutzerId), text, "2026-09"),
    );
    expect(ergebnis.zahlen).toMatchObject({ zeiten: { neu: 0, abgelehnt: 1 } });
    // nothing was taken over: no "übernommen aus …" closing without Sandra's confirmation
    expect(ergebnis.gesperrt).toEqual([]);
    const monat = await json(
      await weber.anfrage(`/api/v1/arbeitszeit/monat?monat=2026-09&nutzerId=${sandra.nutzerId}`),
    );
    expect(monat.abschluss).toBeNull();
  });

  it("the Prüfwert of a month taken over checks out on the check page", async () => {
    const { server, weber, sandra, max } = await weberZumUmzug();
    const text = csv(
      "zeit;z-1;Sandra;01.09.2026;7:00;15:30;30;;;;;",
      "zeit;z-2;Sandra;30.09.2026;22:00;6:00;30;;;;;",
      "abwesenheit;a-1;Sandra;07.09.2026;;;;11.09.2026;Urlaub;;;",
    );
    const ergebnis = await uebernehmen(
      weber,
      koerper(zuordnungFuer(sandra.nutzerId, max.nutzerId), text, "2026-09"),
    );
    expect(ergebnis.gesperrt).toHaveLength(1);
    const monat = await json(
      await weber.anfrage(`/api/v1/arbeitszeit/monat?monat=2026-09&nutzerId=${sandra.nutzerId}`),
    );
    const pruefwert = (monat.abschluss as { pruefwert: string }).pruefwert;
    expect(await pruefen(server, weber.betriebId, pruefwert)).toMatchObject({
      ergebnis: "uebereinstimmend",
    });
  });

  it("does not write overlapping times when two takeovers run at once", async () => {
    const { weber, sandra, max } = await weberZumUmzug();
    const zuordnung = zuordnungFuer(sandra.nutzerId, max.nutzerId);
    const eins = koerper(zuordnung, csv("zeit;z-1;Sandra;01.09.2026;7:00;15:30;30;;;;;"));
    const zwei = {
      ...koerper(zuordnung),
      datei: datei(csv("zeit;y-1;Sandra;01.09.2026;8:00;16:00;30;;;;;"), "zweite.csv"),
    };
    const antworten = await Promise.all([
      weber.anfrage(IMP, { body: eins }),
      weber.anfrage(IMP, { body: zwei }),
    ]);
    const neu = await Promise.all(
      antworten.map(async (a) =>
        a.status === 201
          ? ((await a.json()) as { zahlen: { zeiten: { neu: number } } }).zahlen.zeiten.neu
          : 0,
      ),
    );
    // at most one of the two overlapping spans may become stamps
    expect(neu.reduce((x, y) => x + y, 0)).toBe(1);
  });
});
