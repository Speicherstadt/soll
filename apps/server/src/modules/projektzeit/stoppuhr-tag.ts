import {
  buchungZuordnen,
  type ProjektzeitHinweis,
  projektzeitHinweis,
  type Tag,
  tagInBerlin,
} from "@soll/arbeitszeit";
import type { Db } from "../../db/oeffnen.ts";
import { hatStempelungen, tagLesen } from "../arbeitszeit/index.ts";
import {
  alsBuchung,
  type Buchung,
  buchungAnsicht,
  buchungenAm,
  laufendeVon,
  stempelUmfeld,
  type Wahl,
  zuletztVon,
} from "./buchungen-lesen.ts";
import { erfasstArbeitszeit } from "./personen.ts";

/** The stopwatch's day of one person (GET /stoppuhr, S-602) */
export type StoppuhrTag = {
  nutzerId: string;
  tag: Tag;
  /** the server's clock when it answered, so the app counts the running booking on */
  jetzt: number;
  laufend: Buchung | null;
  buchungen: Buchung[];
  gebuchtMinuten: number;
  /** the stamped working time of the day; null while Soll does not record the person's */
  gestempeltMinuten: number | null;
  hinweis: ProjektzeitHinweis | null;
  zuletzt: Wahl[];
};

/** The working day of now: the day of a shift that runs, else today in Berlin */
const heutigerTag = (db: Db, betriebId: string, nutzerId: string, jetzt: number): Tag =>
  buchungZuordnen(stempelUmfeld(db, betriebId, nutzerId, tagInBerlin(jetzt)), jetzt, jetzt).tag;

/**
 * A working day of a person's project time: its bookings with their reference to the stamps, the
 * sums, and the hint when more project time is booked than working time stamped. Without a date the
 * day of the running booking, else the working day of now.
 */
export const stoppuhrTag = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  datum: Tag | undefined,
  jetzt: number,
): StoppuhrTag => {
  const laufend = laufendeVon(db, betriebId, nutzerId);
  const tag = datum ?? laufend?.tag ?? heutigerTag(db, betriebId, nutzerId, jetzt);
  const umfeld = stempelUmfeld(db, betriebId, nutzerId, tag);
  const buchungen = buchungenAm(db, betriebId, nutzerId, tag).map((zeile) =>
    alsBuchung(zeile, umfeld, jetzt),
  );
  const gebuchtMinuten = buchungen.reduce((summe, buchung) => summe + buchung.minuten, 0);
  const erfasst = erfasstArbeitszeit(
    db,
    betriebId,
    nutzerId,
    hatStempelungen(db, betriebId, nutzerId),
  );
  const gestempeltMinuten = erfasst
    ? (tagLesen(db, betriebId, nutzerId, tag, jetzt)?.stand.istMinuten ?? 0)
    : null;
  return {
    nutzerId,
    tag,
    jetzt,
    laufend: laufend ? buchungAnsicht(db, laufend, jetzt) : null,
    buchungen,
    gebuchtMinuten,
    gestempeltMinuten,
    hinweis:
      gestempeltMinuten === null ? null : projektzeitHinweis({ gebuchtMinuten, gestempeltMinuten }),
    zuletzt: zuletztVon(db, betriebId, nutzerId),
  };
};
