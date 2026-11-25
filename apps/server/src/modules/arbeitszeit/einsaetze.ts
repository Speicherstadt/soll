import type { Monat } from "@soll/arbeitszeit";
import { and, asc, eq, gte, isNull, lt } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { einsaetze } from "../../db/schema.ts";
import { kanonisch } from "../audit/hash.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { rufdienstUm } from "../plandaten/index.ts";
import { abgeschlosseneMonate } from "./abschluss.ts";
import { aufzeichnungen, type Einsatzspanne, lesefenster } from "./monatsinhalt.ts";
import { stempelungenIn } from "./stempelungen.ts";

/*
 * Call-outs from a Rufbereitschaft (S-505): working time from the call to the end of work, the way
 * there and back included (R-12). Begun and ended live on the server's clock, or entered
 * afterwards with a reason; removed only with a reason. Every write goes through the audit chain.
 */

export type Einsatz = typeof einsaetze.$inferSelect;

/** Longest call-out Soll takes: a shift never reaches 24 hours past its start (R-01) */
const LAENGSTER = 24 * 60 * 60_000;
const MINUTE = 60_000;

export type EinsatzFehler =
  | "keine_rufbereitschaft"
  | "laeuft_schon"
  | "laeuft_nicht"
  | "ueberschneidung"
  | "zukunft"
  | "zu_lang"
  | "monat_gesperrt"
  | "unbekannt";

export type EinsatzErgebnis = { ok: true; einsatz: Einsatz } | { ok: false; grund: EinsatzFehler };

/** A person's call-outs in force (not removed) that begin from `von` to before `bis` */
export const einsaetzeIn = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  von: number,
  bis: number,
): Einsatz[] =>
  db
    .select()
    .from(einsaetze)
    .where(
      and(
        eq(einsaetze.betriebId, betriebId),
        eq(einsaetze.nutzerId, nutzerId),
        eq(einsaetze.entfernt, false),
        gte(einsaetze.beginn, von),
        lt(einsaetze.beginn, bis),
      ),
    )
    .orderBy(asc(einsaetze.beginn))
    .all();

const laufender = (db: Db, betriebId: string, nutzerId: string): Einsatz | undefined =>
  db
    .select()
    .from(einsaetze)
    .where(
      and(
        eq(einsaetze.betriebId, betriebId),
        eq(einsaetze.nutzerId, nutzerId),
        eq(einsaetze.entfernt, false),
        isNull(einsaetze.ende),
      ),
    )
    .get();

const einsatzLesen = (db: Db, betriebId: string, einsatzId: string): Einsatz | undefined =>
  db
    .select()
    .from(einsaetze)
    .where(and(eq(einsaetze.betriebId, betriebId), eq(einsaetze.einsatzId, einsatzId)))
    .get();

/** The call-out records of a closed month, as closing and the check page read them */
const einsatzRecords = (monat: Monat, stempel: Parameters<typeof aufzeichnungen>[1], liste: readonly Einsatzspanne[]) =>
  kanonisch(
    aufzeichnungen(monat, stempel, () => null, [], { einsaetze: liste }).map(
      (tag) => tag.einsaetze ?? [],
    ),
  );

/**
 * Whether a change of a person's call-outs alters the records of a closed month (docs/plan.md,
 * "Monat gesperrt"): every closed month whose window holds an instant of the change is compared
 * before and after, from the same window as closing and the check page
 */
const gesperrt = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  zeitpunkte: readonly number[],
  nachher: (vorher: Einsatz[]) => Einsatzspanne[],
): boolean =>
  [...abgeschlosseneMonate(db, betriebId, nutzerId)].some((monat) => {
    const { von, bis } = lesefenster(monat);
    if (!zeitpunkte.some((zeitpunkt) => zeitpunkt >= von && zeitpunkt < bis)) return false;
    const stempel = stempelungenIn(db, betriebId, nutzerId, von, bis);
    const vorher = einsaetzeIn(db, betriebId, nutzerId, von, bis);
    const neu = nachher(vorher).filter(({ beginn }) => beginn >= von && beginn < bis);
    return einsatzRecords(monat, stempel, vorher) !== einsatzRecords(monat, stempel, neu);
  });

const ueberschneidet = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  spanne: { beginn: number; ende: number },
  ausser?: string,
): boolean =>
  einsaetzeIn(db, betriebId, nutzerId, spanne.beginn - LAENGSTER, spanne.ende).some(
    (einsatz) =>
      einsatz.einsatzId !== ausser &&
      einsatz.beginn < spanne.ende &&
      (einsatz.ende === null || einsatz.ende > spanne.beginn),
  );

/** Begins a call-out now, on the server's clock, in the person's published Rufbereitschaft */
export const einsatzBeginnen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
): EinsatzErgebnis => {
  const jetzt = Math.floor(kontext.jetzt / MINUTE) * MINUTE;
  const dienst = rufdienstUm(db, kontext.betriebId, nutzerId, jetzt);
  if (!dienst) return { ok: false, grund: "keine_rufbereitschaft" };
  if (laufender(db, kontext.betriebId, nutzerId)) return { ok: false, grund: "laeuft_schon" };
  if (gesperrt(db, kontext.betriebId, nutzerId, [jetzt], (v) => [...v, { beginn: jetzt, ende: null }]))
    return { ok: false, grund: "monat_gesperrt" };
  const einsatz = schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("einsaetze", {
      betriebId: kontext.betriebId,
      einsatzId: crypto.randomUUID(),
      nutzerId,
      rufdienstId: dienst.rufdienstId,
      beginn: jetzt,
      ende: null,
      erstelltVon: kontext.akteur,
      erstelltAm: kontext.jetzt,
    }),
  );
  return { ok: true, einsatz };
};

/**
 * Ends the person's running call-out now, rounded up to the minute so it never ends before the work
 * did (CLAUDE.md, "Never": no rounding to the person's disadvantage)
 */
export const einsatzBeenden = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
): EinsatzErgebnis => {
  const laeuft = laufender(db, kontext.betriebId, nutzerId);
  if (!laeuft) return { ok: false, grund: "laeuft_nicht" };
  const ende = Math.max(laeuft.beginn + MINUTE, Math.ceil(kontext.jetzt / MINUTE) * MINUTE);
  if (ende - laeuft.beginn > LAENGSTER) return { ok: false, grund: "zu_lang" };
  const nachher = (vorher: Einsatz[]) =>
    vorher.map((e) => (e.einsatzId === laeuft.einsatzId ? { ...e, ende } : e));
  if (gesperrt(db, kontext.betriebId, nutzerId, [laeuft.beginn, ende], nachher))
    return { ok: false, grund: "monat_gesperrt" };
  const einsatz = schreiben(schreibDb, kontext, (s) =>
    s.aendern("einsaetze", { einsatzId: laeuft.einsatzId }, { ende }),
  );
  return { ok: true, einsatz };
};

/**
 * Enters a call-out afterwards, with a reason, as the person or whoever corrects times: it begins
 * in the person's published Rufbereitschaft, has ended, lasts under 24 hours, overlaps no other one
 * and changes no closed month
 */
export const einsatzNachtragen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: { nutzerId: string; beginn: number; ende: number; grund: string },
): EinsatzErgebnis => {
  const { nutzerId, beginn, ende, grund } = angaben;
  if (ende > kontext.jetzt) return { ok: false, grund: "zukunft" };
  if (ende - beginn > LAENGSTER) return { ok: false, grund: "zu_lang" };
  const dienst = rufdienstUm(db, kontext.betriebId, nutzerId, beginn);
  if (!dienst) return { ok: false, grund: "keine_rufbereitschaft" };
  if (ueberschneidet(db, kontext.betriebId, nutzerId, { beginn, ende }))
    return { ok: false, grund: "ueberschneidung" };
  if (gesperrt(db, kontext.betriebId, nutzerId, [beginn, ende], (v) => [...v, { beginn, ende }]))
    return { ok: false, grund: "monat_gesperrt" };
  const einsatz = schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("einsaetze", {
      betriebId: kontext.betriebId,
      einsatzId: crypto.randomUUID(),
      nutzerId,
      rufdienstId: dienst.rufdienstId,
      beginn,
      ende,
      grund,
      erstelltVon: kontext.akteur,
      erstelltAm: kontext.jetzt,
    }),
  );
  return { ok: true, einsatz };
};

/**
 * Removes a call-out with a reason; the row stays, marked, and the chain keeps every version. Only
 * the person's own, unless `fuerAndere` (whoever corrects times).
 */
export const einsatzEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: { einsatzId: string; grund: string; fuerAndere: boolean },
): EinsatzErgebnis => {
  const alt = einsatzLesen(db, kontext.betriebId, angaben.einsatzId);
  if (!alt || alt.entfernt || (!angaben.fuerAndere && alt.nutzerId !== kontext.akteur))
    return { ok: false, grund: "unbekannt" };
  const nachher = (vorher: Einsatz[]) => vorher.filter((e) => e.einsatzId !== alt.einsatzId);
  const zeitpunkte = alt.ende === null ? [alt.beginn] : [alt.beginn, alt.ende];
  if (gesperrt(db, kontext.betriebId, alt.nutzerId, zeitpunkte, nachher))
    return { ok: false, grund: "monat_gesperrt" };
  const einsatz = schreiben(schreibDb, kontext, (s) =>
    s.aendern(
      "einsaetze",
      { einsatzId: alt.einsatzId },
      { entfernt: true, entferntGrund: angaben.grund },
    ),
  );
  return { ok: true, einsatz };
};
