import {
  type Abwesenheitsart,
  arbeitstage,
  type Stempelung,
  sichtbareArt,
} from "@soll/arbeitszeit";
import type { Stundenzettel } from "@soll/export";
import type { MonatStatus } from "./monatsabschluss.ts";
import type { Tagesabwesenheit } from "./monatsinhalt.ts";

/** The words of the sheet for absences, German like the whole sheet */
const ABWESENHEIT: Record<Abwesenheitsart | "abwesend", string> = {
  urlaub: "Urlaub",
  krank: "krank",
  kind_krank: "Kind krank",
  sonderurlaub: "Sonderurlaub",
  ueberstundenabbau: "Überstundenabbau",
  abwesend: "abwesend",
};

/** The absences of a day as the sheet writes them, „krank“ only for whoever may see it */
const abwesenheitText = (
  liste: readonly Tagesabwesenheit[] | undefined,
  gesundheit: boolean,
): string | null =>
  liste === undefined
    ? null
    : liste
        .map(
          (a) => `${ABWESENHEIT[sichtbareArt(a.art, gesundheit)]}${a.halb ? " (halber Tag)" : ""}`,
        )
        .join(", ");

/**
 * The time sheet of a month (S-306) from its content: the closed content once closed, so the sheet
 * shows what the Prüfwert covers. `name` gives the names of the people who confirmed and closed.
 */
export const stundenzettelAus = (
  status: MonatStatus,
  angaben: {
    betrieb: string;
    person: string;
    name: (nutzerId: string) => string;
    pruefseite: string;
    jetzt: number;
    /** whether the reader may see sickness; otherwise „abwesend“ and no R-24 (S-401) */
    gesundheit?: boolean;
  },
): Stundenzettel => {
  const { inhalt } = status;
  const gesundheit = angaben.gesundheit ?? true;
  const befunde = inhalt.befunde.filter((befund) => gesundheit || befund.regel !== "R-24");
  const stempel: Stempelung[] = inhalt.tage.flatMap((tag) =>
    tag.stempel.map(([art, zeitpunkt]) => ({ art, zeitpunkt })),
  );
  const ergebnis = arbeitstage(stempel, status.abschluss?.am ?? angaben.jetzt);
  const tage = new Map((ergebnis.ok ? ergebnis.wert : []).map((tag) => [tag.tag, tag]));
  return {
    betrieb: angaben.betrieb,
    person: angaben.person,
    monat: inhalt.monat,
    tage: inhalt.tage.map((aufzeichnung) => {
      const tag = tage.get(aufzeichnung.tag);
      return {
        tag: aufzeichnung.tag,
        beginn: tag?.beginn ?? null,
        ende: tag?.ende ?? null,
        pauseMinuten: tag?.pausenMinuten ?? 0,
        arbeitsMinuten: tag?.arbeitsMinuten ?? 0,
        sollMinuten: aufzeichnung.modellMinuten,
        abwesenheit: abwesenheitText(aufzeichnung.abwesenheiten, gesundheit),
        hinweise: befunde
          .filter((befund) => befund.tage.includes(aufzeichnung.tag))
          .map(
            (befund) => `${befund.schwere === "verstoss" ? "Verstoß" : "Hinweis"} ${befund.norm}`,
          ),
      };
    }),
    summen: inhalt.summen,
    nichtHinterlegt: inhalt.nichtHinterlegt,
    befunde,
    gegeneintraege: inhalt.gegeneintraege,
    bestaetigt:
      status.bestaetigung?.gueltig === true
        ? { name: angaben.name(status.bestaetigung.von), am: status.bestaetigung.am }
        : null,
    abgeschlossen: status.abschluss
      ? {
          name: angaben.name(status.abschluss.von),
          am: status.abschluss.am,
          grund: status.abschluss.grund,
        }
      : null,
    pruefwert: status.abschluss?.pruefwert ?? null,
    pruefseite: angaben.pruefseite,
  };
};
