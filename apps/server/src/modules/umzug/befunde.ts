import {
  arbeitstage,
  type Befund,
  hoechstarbeitszeit,
  ruhepausen,
  ruhezeit,
  type Stempelung,
} from "@soll/arbeitszeit";
import type { ImportZeit } from "@soll/import";
import { stempelAus } from "./plan-zeiten.ts";

/*
 * The findings of the rules on the times of a file, per person of the file (BAULISTE.md S-701,
 * docs/plan.md "Ehrlich"): what happened in the old tool is shown as it was, nothing is changed.
 * The same functions check the day and the month in Soll (R-01, R-02, R-04, R-05 per day, the
 * longest working time, breaks and rest), so a taken-over time is checked as an own one.
 */

export type Vorschaubefund = Pick<Befund, "regel" | "norm" | "schwere" | "tage"> & {
  person: string;
};

const befundeVon = (stempel: readonly Stempelung[], jetzt: number): Befund[] => {
  const ergebnis = arbeitstage(
    [...stempel].sort((a, b) => a.zeitpunkt - b.zeitpunkt),
    jetzt,
  );
  if (!ergebnis.ok) return [];
  const tage = ergebnis.wert;
  return [
    ...tage.flatMap((tag) => tag.befunde),
    ...hoechstarbeitszeit(tage).befunde,
    ...ruhepausen(tage).befunde,
    ...ruhezeit(tage, { jetzt }).befunde,
  ];
};

/** The findings of every person of the file, by person and then by their first day */
export const vorschauBefunde = (zeiten: readonly ImportZeit[], jetzt: number): Vorschaubefund[] => {
  const jePerson = new Map<string, Stempelung[]>();
  for (const zeit of zeiten) {
    const stempel = stempelAus(zeit);
    if (typeof stempel === "string") continue;
    jePerson.set(zeit.person, [...(jePerson.get(zeit.person) ?? []), ...stempel]);
  }
  return [...jePerson]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([person, stempel]) =>
      befundeVon(stempel, jetzt)
        .map(({ regel, norm, schwere, tage }) => ({
          person,
          regel,
          norm,
          schwere,
          tage: [...tage],
        }))
        .sort((a, b) => (a.tage[0] ?? "").localeCompare(b.tage[0] ?? "")),
    );
};
