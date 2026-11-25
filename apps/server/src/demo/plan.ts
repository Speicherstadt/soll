import { ersterTag, plusMonate, plusTage, type Tag } from "@soll/arbeitszeit";
import { BETRIEBE, type Betrieb } from "./betriebe.ts";
import { cafeEreignisse } from "./cafe.ts";
import { type Ereignis, geordnet, zufall } from "./ereignis.ts";
import { weberEreignisse } from "./weber.ts";
import { um, type Zeitraum, zeitraumVon } from "./zeitraum.ts";

/**
 * The whole story of the demo (BAULISTE.md S-909) as an ordered list of events, a pure function of
 * `heute`: the same day gives the same events, the same minutes and the same order.
 */

/** When the businesses are set up: 9:00 on the day before the first day of data */
export const aufbauZeit = (zr: Zeitraum): number => um(plusTage(zr.beginn, -1), 9, 0);

/**
 * Each full month: on the first of the next month every person confirms it at 9:30 and the owner
 * closes it at 10:00 (docs/monatsabschluss.md): after the corrections of the morning (8:40, 9:00),
 * more than 9 hours after the month's last stamp (20:08 at the latest, `schicht_kann_weiterlaufen`),
 * and before the story ends at 10:30, so a `--heute` on the 1st still closes all three months
 */
const abschluesse = (zr: Zeitraum, betrieb: Betrieb): Ereignis[] => {
  const inhaber = betrieb.personen.find((p) => p.rolle === "inhaber")?.schluessel ?? "";
  const stempelnde = betrieb.personen.filter((p) => p.modell !== null);
  return zr.volleMonate.flatMap((monat) => {
    const erster: Tag = ersterTag(plusMonate(monat, 1));
    return stempelnde.flatMap((person, i) => [
      {
        zeit: um(erster, 9, 30 + 2 * i),
        betrieb: betrieb.schluessel,
        handlung: { art: "bestaetigen", person: person.schluessel, monat },
      },
      {
        zeit: um(erster, 10, i),
        betrieb: betrieb.schluessel,
        handlung: { art: "abschliessen", von: inhaber, person: person.schluessel, monat },
      },
    ]);
  });
};

/** Everything that happens from the setup to `heute` 10:30, in order; nothing after that */
export const ereignisseBis = (heute: Tag): { zeitraum: Zeitraum; ereignisse: Ereignis[] } => {
  const zeitraum = zeitraumVon(heute);
  const alle = [
    ...weberEreignisse(zeitraum, zufall(`weber-${heute}`)),
    ...cafeEreignisse(zeitraum, zufall(`cafe-${heute}`)),
    ...BETRIEBE.flatMap((betrieb) => abschluesse(zeitraum, betrieb)),
  ];
  return {
    zeitraum,
    ereignisse: geordnet(
      alle.filter((e) => e.zeit > aufbauZeit(zeitraum) && e.zeit <= zeitraum.ende),
    ),
  };
};
