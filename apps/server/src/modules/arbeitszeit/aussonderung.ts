import {
  beginnInBerlin,
  type Monat,
  monatVon,
  stempelSchluessel,
  stempeltage,
  type Tag,
  tagInBerlin,
} from "@soll/arbeitszeit";
import { and, asc, eq, isNotNull, lt } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { abwesenheiten, korrekturen, monatsabschluesse, stempelungen } from "../../db/schema.ts";
import { schreiben } from "../audit/index.ts";
import { aenderungGesperrt, ausgesonderteMonate } from "./abschluss.ts";
import { type Aufbewahrungsjahre, aufbewahrungsjahre, aussonderbarAb } from "./aufbewahrung.ts";
import { lesefenster } from "./monatsinhalt.ts";
import { stempelungenIn } from "./stempelungen.ts";
import { lohnmodelle } from "./zuordnungen.ts";

/*
 * Removal after the retention period (S-901, docs/plan.md "Aufbewahrung je Monatsabschluss"): once
 * the period of a closed month has ended, its stamps, counter-entries, closing rows and the absences
 * lying wholly in removed months are deleted
 * with the stored contents of their links. The links stay, as they hold only the contents' hashes,
 * so the chain still verifies and every Prüfwert a person holds still matches its link; the removal
 * itself is a row of `aussonderungen`, and so a link of the chain. The month stays locked.
 */

export type Aussonderung = {
  betriebId: string;
  nutzerId: string;
  monat: Monat;
  jahre: Aufbewahrungsjahre;
  zeilen: number;
  inhalte: number;
};

/** A month due whose removal would change the records of another closed month: it waits */
export type Aufgeschoben = { betriebId: string; nutzerId: string; monat: Monat };

type Abschluss = Pick<
  typeof monatsabschluesse.$inferSelect,
  "betriebId" | "abschlussId" | "nutzerId" | "monat" | "erstelltAm"
>;
type Stempelzeile = typeof stempelungen.$inferSelect;

/**
 * The days the counter-entries booked in a month correct: payroll posts each under the model of
 * that day (`lohnmonat` in @soll/export), so they count for the month's years too
 */
const korrigierteTage = (db: Db, a: Abschluss): Tag[] =>
  db
    .select({ tag: korrekturen.tag })
    .from(korrekturen)
    .where(
      and(
        eq(korrekturen.betriebId, a.betriebId),
        eq(korrekturen.nutzerId, a.nutzerId),
        eq(korrekturen.gebuchtIn, a.monat),
      ),
    )
    .all()
    .map(({ tag }) => tag as Tag);

/** The closed months whose period has ended by `jetzt`, the oldest first */
const faellige = (db: Db, jetzt: number): (Abschluss & { jahre: Aufbewahrungsjahre })[] => {
  const heute = tagInBerlin(jetzt);
  // no period is shorter than 2 years after the year of closing: only older rows can be due
  const fruehestens = beginnInBerlin(`${Number(heute.slice(0, 4)) - 2}-01-01`);
  return db
    .select({
      betriebId: monatsabschluesse.betriebId,
      abschlussId: monatsabschluesse.abschlussId,
      nutzerId: monatsabschluesse.nutzerId,
      monat: monatsabschluesse.monat,
      erstelltAm: monatsabschluesse.erstelltAm,
    })
    .from(monatsabschluesse)
    .where(
      and(
        eq(monatsabschluesse.schritt, "abgeschlossen"),
        lt(monatsabschluesse.erstelltAm, fruehestens),
      ),
    )
    .orderBy(asc(monatsabschluesse.monat))
    .all()
    .map((abschluss) => ({
      ...abschluss,
      jahre: aufbewahrungsjahre(
        lohnmodelle(db, abschluss.betriebId, abschluss.nutzerId),
        abschluss.monat,
        korrigierteTage(db, abschluss),
      ),
    }))
    .filter((abschluss) => aussonderbarAb(abschluss.erstelltAm, abschluss.jahre) <= heute);
};

/**
 * Whether a removed stamp goes with month `monat`: it has no working day of its own, so it goes with
 * the one it would have in force among the stamps in force now (a Gehen of a night shift with the
 * day the shift began), and only once the month of its calendar day is removed too; until then it
 * stays as part of the correction history of a month that is kept (GoBD Rz. 107 ff.)
 */
const entfernteGehoert = (
  inKraft: readonly Stempelzeile[],
  z: Stempelzeile,
  monat: Monat,
  weg: ReadonlySet<Monat>,
): boolean => {
  const alsInKraft = { ...z, entfernt: false };
  const tag = stempeltage([...inKraft, alsInKraft]).get(stempelSchluessel(alsInKraft));
  const kalender = monatVon(tagInBerlin(z.zeitpunkt));
  return monatVon(tag ?? tagInBerlin(z.zeitpunkt)) === monat && weg.has(kalender);
};

/**
 * The stamp rows of a month: every version of a stamp goes with its newest one, so no replaced
 * version comes back in force. A stamp in force goes with its working day as the month was read
 * (`lesefenster`), a removed one with its calendar day. `inKraft` are those of them in force.
 */
const stempelzeilen = (
  db: Db,
  a: Abschluss,
): { zeilen: Stempelzeile[]; inKraft: Stempelzeile[] } => {
  const alle = db
    .select()
    .from(stempelungen)
    .where(and(eq(stempelungen.betriebId, a.betriebId), eq(stempelungen.nutzerId, a.nutzerId)))
    .all();
  const nachfolger = new Map(alle.flatMap((z) => (z.ersetzt ? [[z.ersetzt, z] as const] : [])));
  const neueste = (zeile: Stempelzeile): Stempelzeile => {
    const gesehen = new Set<string>();
    let z = zeile;
    while (!gesehen.has(z.stempelId)) {
      gesehen.add(z.stempelId);
      const neuer = nachfolger.get(z.stempelId);
      if (!neuer) return z;
      z = neuer;
    }
    return z;
  };
  const { von, bis } = lesefenster(a.monat);
  const imFenster = alle.filter(
    (z) => !nachfolger.has(z.stempelId) && !z.entfernt && z.zeitpunkt >= von && z.zeitpunkt < bis,
  );
  const tage = stempeltage(imFenster);
  const weg = new Set([a.monat, ...ausgesonderteMonate(db, a.betriebId, a.nutzerId)]);
  const gehoert = (z: Stempelzeile): boolean =>
    z.entfernt
      ? entfernteGehoert(imFenster, z, a.monat, weg)
      : monatVon(tage.get(stempelSchluessel(z)) ?? tagInBerlin(z.zeitpunkt)) === a.monat &&
        z.zeitpunkt >= von &&
        z.zeitpunkt < bis;
  const zeilen = alle.filter((z) => gehoert(neueste(z)));
  return { zeilen, inKraft: zeilen.filter((z) => !z.entfernt && !nachfolger.has(z.stempelId)) };
};

/** Whether removing these stamps would change the records of another closed month of the person */
const aendertAndere = (db: Db, a: Abschluss, inKraft: readonly Stempelzeile[]): boolean => {
  const weg = new Set(inKraft.map((z) => z.stempelId));
  return aenderungGesperrt(db, a.betriebId, a.nutzerId, {
    zeitpunkte: inKraft.map((z) => z.zeitpunkt),
    vorher: (von, bis) => stempelungenIn(db, a.betriebId, a.nutzerId, von, bis),
    nachher: (vorher) => vorher.filter((s) => !weg.has(s.stempelId)),
    ausser: new Set([a.monat, ...ausgesonderteMonate(db, a.betriebId, a.nutzerId)]),
  });
};

const korrekturenIn = (db: Db, a: Abschluss) =>
  db
    .select({ korrekturId: korrekturen.korrekturId })
    .from(korrekturen)
    .where(
      and(
        eq(korrekturen.betriebId, a.betriebId),
        eq(korrekturen.nutzerId, a.nutzerId),
        eq(korrekturen.gebuchtIn, a.monat),
      ),
    )
    .all();

const schritteIn = (db: Db, a: Abschluss) =>
  db
    .select({ abschlussId: monatsabschluesse.abschlussId })
    .from(monatsabschluesse)
    .where(
      and(
        eq(monatsabschluesse.betriebId, a.betriebId),
        eq(monatsabschluesse.nutzerId, a.nutzerId),
        eq(monatsabschluesse.monat, a.monat),
      ),
    )
    .all();

/** The months from `von` to `bis`, both included */
const monateVonBis = (von: Monat, bis: Monat): Monat[] => {
  const monate: Monat[] = [];
  for (let [jahr, monat] = von.split("-").map(Number) as [number, number]; ; monat += 1) {
    if (monat > 12) [jahr, monat] = [jahr + 1, 1];
    const m = `${jahr}-${String(monat).padStart(2, "0")}` as Monat;
    monate.push(m);
    if (m >= bis) return monate;
  }
};

/**
 * The absences of the person whose every month is removed once this one is: an absence is part of
 * the content of each month it touches (S-401), so one reaching into a month that is kept stays,
 * and one still open (a sickness without its end) stays too
 */
const abwesenheitenIn = (db: Db, a: Abschluss) => {
  const weg = new Set([a.monat, ...ausgesonderteMonate(db, a.betriebId, a.nutzerId)]);
  return db
    .select({
      abwesenheitId: abwesenheiten.abwesenheitId,
      von: abwesenheiten.von,
      bis: abwesenheiten.bis,
    })
    .from(abwesenheiten)
    .where(
      and(
        eq(abwesenheiten.betriebId, a.betriebId),
        eq(abwesenheiten.nutzerId, a.nutzerId),
        isNotNull(abwesenheiten.bis),
      ),
    )
    .all()
    .filter(({ von, bis }) =>
      monateVonBis(monatVon(von), monatVon(bis ?? von)).every((m) => weg.has(m)),
    )
    .map(({ abwesenheitId }) => ({ abwesenheitId }));
};

/** Removes one month in one transaction, its record included */
const monatAussondern = (
  db: Db,
  schreibDb: SchreibDb,
  a: Abschluss & { jahre: Aufbewahrungsjahre },
  stempel: readonly Stempelzeile[],
  jetzt: number,
): Aussonderung =>
  schreiben(schreibDb, { betriebId: a.betriebId, akteur: "system", jetzt }, (s) => {
    const entfernt = [
      ...stempel.map((z) => s.aussondern("stempelungen", { stempelId: z.stempelId })),
      ...korrekturenIn(db, a).map((k) => s.aussondern("korrekturen", k)),
      ...schritteIn(db, a).map((schritt) => s.aussondern("monatsabschluesse", schritt)),
      ...abwesenheitenIn(db, a).map((zeile) => s.aussondern("abwesenheiten", zeile)),
    ];
    const zeilen = entfernt.length;
    const inhalte = entfernt.reduce((summe, e) => summe + e.inhalte, 0);
    s.einfuegen("aussonderungen", {
      betriebId: a.betriebId,
      aussonderungId: crypto.randomUUID(),
      nutzerId: a.nutzerId,
      monat: a.monat,
      abschlussId: a.abschlussId,
      jahre: a.jahre,
      abgeschlossenAm: a.erstelltAm,
      ausgesondertAm: jetzt,
      zeilen,
      inhalte,
    });
    return { ...a, zeilen, inhalte };
  });

/**
 * Removes the content of every closed month whose retention period ended by `jetzt`, in every
 * business. A month whose removal would change the records of another closed month (a night shift
 * across the turn of the year whose next month is kept longer) waits until that one is due too.
 */
export const aussondern = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: number,
): { ausgesondert: Aussonderung[]; aufgeschoben: Aufgeschoben[] } => {
  const ausgesondert: Aussonderung[] = [];
  const aufgeschoben: Aufgeschoben[] = [];
  for (const a of faellige(db, jetzt)) {
    const { zeilen, inKraft } = stempelzeilen(db, a);
    if (aendertAndere(db, a, inKraft)) {
      aufgeschoben.push({ betriebId: a.betriebId, nutzerId: a.nutzerId, monat: a.monat });
      continue;
    }
    const {
      betriebId,
      nutzerId,
      monat,
      jahre,
      zeilen: n,
      inhalte,
    } = monatAussondern(db, schreibDb, a, zeilen, jetzt);
    ausgesondert.push({ betriebId, nutzerId, monat, jahre, zeilen: n, inhalte });
  }
  return { ausgesondert, aufgeschoben };
};

/**
 * Runs the removal now and then every `intervallMs` (6 h); the log counts months, never names a
 * person. Returns the function that stops it.
 */
export const aussonderungsSchleife = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  log: (zeile: string) => void,
  intervallMs = 6 * 60 * 60_000,
): (() => void) => {
  const lauf = () => {
    try {
      const { ausgesondert, aufgeschoben } = aussondern(db, schreibDb, jetzt());
      if (ausgesondert.length > 0 || aufgeschoben.length > 0)
        log(
          JSON.stringify({
            msg: "aussonderung",
            monate: ausgesondert.length,
            aufgeschoben: aufgeschoben.length,
          }),
        );
    } catch (fehler) {
      log(JSON.stringify({ msg: "aussonderung fehlgeschlagen", fehler: String(fehler) }));
    }
  };
  const start = setTimeout(lauf, 0);
  const takt = setInterval(lauf, intervallMs);
  return () => {
    clearTimeout(start);
    clearInterval(takt);
  };
};
