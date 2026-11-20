import {
  aktuellerTag,
  beginnInBerlin,
  plusTage,
  stempelungenAm,
  type Tag,
  type Tagesstand,
  tagesstand,
  tagInBerlin,
} from "@soll/arbeitszeit";
import type { Db } from "../../db/oeffnen.ts";
import { type Aenderung, aenderungenIn, type Stempel, stempelungenIn } from "./stempelungen.ts";
import { sollAm } from "./zuordnungen.ts";

/** A working day of one person as Heute and the times of a day show it (S-304) */
export type TagAnsicht = {
  tag: Tag;
  /** the server's clock when it answered, so the app counts on from there */
  jetzt: number;
  /** from the person's working-time model; null: nicht hinterlegt */
  sollMinuten: number | null;
  stand: Tagesstand;
  /** the stamps in force of the day */
  stempelungen: Stempel[];
  /**
   * the stamps in force around the day (the two days before and after), from which the app counts
   * the running day on with the same functions
   */
  umfeld: Stempel[];
  aenderungen: Aenderung[];
};

/**
 * The stamps a day needs: from two days before, so a night shift keeps its Kommen and the rest
 * before the day is known (R-05), to the end of the day after, for the rest after it
 */
const umfeldVon = (tag: Tag) => ({
  von: beginnInBerlin(plusTage(tag, -2)),
  bis: beginnInBerlin(plusTage(tag, 2)),
});

/**
 * The day `datum` of a person, or without a date the running day: the day of a shift that runs,
 * else today in Berlin
 */
export const tagLesen = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  datum: Tag | undefined,
  jetzt: number,
): TagAnsicht | null => {
  const heute = umfeldVon(tagInBerlin(jetzt));
  const tag =
    datum ?? aktuellerTag(stempelungenIn(db, betriebId, nutzerId, heute.von, jetzt + 1), jetzt);
  const { von, bis } = umfeldVon(tag);
  const umfeld = stempelungenIn(db, betriebId, nutzerId, von, bis);
  const stand = tagesstand(umfeld, jetzt, tag);
  if (!stand.ok) return null;
  const amTag = stempelungenAm(umfeld, jetzt, tag);
  const ids = new Set(amTag.map((stempel) => stempel.stempelId));
  const aenderungen = aenderungenIn(db, betriebId, nutzerId, von, bis).filter(
    (aenderung) =>
      ids.has(aenderung.stempelId) ||
      [aenderung.vorher, aenderung.nachher].some(
        (stempel) => stempel !== null && tagInBerlin(stempel.zeitpunkt) === tag,
      ),
  );
  return {
    tag,
    jetzt,
    sollMinuten: sollAm(db, betriebId, nutzerId, tag),
    stand: stand.wert,
    stempelungen: amTag,
    umfeld,
    aenderungen,
  };
};
