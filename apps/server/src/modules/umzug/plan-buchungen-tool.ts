import type { ImportBuchung, Zuordnung } from "@soll/import";
import type { NeueBuchung, PlanGrund, Stand } from "./plan-typen.ts";

/*
 * Bookings of project time the old tool kept itself (Kimai's timesheets, BAULISTE.md S-705): each on
 * the project and the activity the import created or matched for the ids it names. A booking whose
 * project or activity the owner left out is left out too; one that overlaps a booking of the person
 * there already, or one taken in this run, is refused; one of a time the run does not take over
 * (named by the time's id, not by its span: two accounts of the tool may be one member) is left
 * out with it, as S-702 books only for a time taken over. Its id in Soll is the tool's own.
 */

/** The ids in Soll of the projects and activities of the file, null when not taken over */
export type Bezugsids = {
  projekte: ReadonlyMap<string, string | null>;
  taetigkeiten: ReadonlyMap<string, string | null>;
};

type Spanne = { beginn: number; ende: number };
/** The bookings taken so far in this run, per person */
export type GenommeneBuchungen = Map<string, Spanne[]>;
/** The ids of the times this run does not take over: their bookings are not taken over either */
export type VerworfeneZeiten = ReadonlySet<string>;

export type ToolBuchungsergebnis =
  | { art: "vorhanden" | "ausgelassen" }
  | { art: "abgelehnt"; grund: PlanGrund }
  | { art: "neu"; buchung: NeueBuchung };

const ueberschneiden = (a: Spanne, b: Spanne): boolean => a.beginn < b.ende && b.beginn < a.ende;

/** The member of a booking's person, or what becomes of the booking without one */
const personVon = (
  satz: ImportBuchung,
  zuordnung: Zuordnung,
  stand: Stand,
): string | ToolBuchungsergebnis => {
  const nutzerId = zuordnung.personen[satz.person] ?? null;
  if (nutzerId === null) return { art: "ausgelassen" };
  return stand.mitglieder.has(nutzerId)
    ? nutzerId
    : { art: "abgelehnt", grund: "person_unbekannt" };
};

export const toolBuchungPlanen = (
  satz: ImportBuchung,
  kontext: {
    zuordnung: Zuordnung;
    stand: Stand;
    ids: Bezugsids;
    genommen: GenommeneBuchungen;
    verworfen: VerworfeneZeiten;
  },
): ToolBuchungsergebnis => {
  const { stand, ids, genommen } = kontext;
  const nutzerId = personVon(satz, kontext.zuordnung, stand);
  if (typeof nutzerId !== "string") return nutzerId;
  if (stand.vorhanden.buchungen.has(satz.externalId)) return { art: "vorhanden" };
  if (kontext.verworfen.has(satz.zeit)) return { art: "ausgelassen" };
  if (!stand.module.projektzeit) return { art: "abgelehnt", grund: "modul_aus" };
  const projektId = ids.projekte.get(satz.projekt) ?? null;
  const taetigkeitId = ids.taetigkeiten.get(satz.taetigkeit) ?? null;
  if (projektId === null || taetigkeitId === null) return { art: "ausgelassen" };
  if (satz.ende > stand.jetzt) return { art: "abgelehnt", grund: "zukunft" };
  const spanne = { beginn: satz.beginn, ende: satz.ende };
  const bisher = genommen.get(nutzerId) ?? [];
  if (
    bisher.some((b) => ueberschneiden(b, spanne)) ||
    stand.buchungUeberschneidet(nutzerId, spanne)
  )
    return { art: "abgelehnt", grund: "ueberschneidung" };
  bisher.push(spanne);
  genommen.set(nutzerId, bisher);
  return {
    art: "neu",
    buchung: {
      nutzerId,
      projektId,
      taetigkeitId,
      ...spanne,
      tag: satz.tag,
      externId: satz.externalId,
    },
  };
};
