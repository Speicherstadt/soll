import {
  beginnInBerlin,
  type Monat,
  monatVon,
  plusMonate,
  plusTage,
  type Stempelung,
  stempelSchluessel,
  stempeltage,
  type Tag,
  tageswerteDesInhalts,
  tagInBerlin,
} from "@soll/arbeitszeit";
import type { PruefPerson, PruefTag } from "@soll/export";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Db } from "../../db/oeffnen.ts";
import { stempelungen } from "../../db/schema.ts";
import { type Aenderung, aenderungenIn } from "./aenderungen.ts";
import { gegeneintraegeVon } from "./monat.ts";
import { type MonatStatus, monatStatus } from "./monatsabschluss.ts";

/*
 * A person's working days in a period for the Prüfexport (S-309): the days of a closed month as
 * closed (what the Prüfwert covers), the others as they stand; with when each day was recorded
 * (§ 17 Abs. 1 MiLoG), the changes by hand and the counter-entries.
 */

/** The months a period touches, in order */
const monateIm = (von: Tag, bis: Tag): Monat[] => {
  const monate: Monat[] = [];
  for (let m = monatVon(von); m <= monatVon(bis); m = plusMonate(m, 1)) monate.push(m);
  return monate;
};

const schluessel = (art: string, zeitpunkt: number) => `${art}@${zeitpunkt}`;
const nachfolger = alias(stempelungen, "nachfolger");

/** The stamps in force from `von` to before `bis`, with when the server recorded each */
const stempelInKraft = (db: Db, betriebId: string, nutzerId: string, von: number, bis: number) =>
  db
    .select({
      art: stempelungen.art,
      zeitpunkt: stempelungen.zeitpunkt,
      am: stempelungen.erstelltAm,
    })
    .from(stempelungen)
    .leftJoin(
      nachfolger,
      and(
        eq(nachfolger.betriebId, stempelungen.betriebId),
        eq(nachfolger.ersetzt, stempelungen.stempelId),
      ),
    )
    .where(
      and(
        eq(stempelungen.betriebId, betriebId),
        eq(stempelungen.nutzerId, nutzerId),
        gte(stempelungen.zeitpunkt, von),
        lt(stempelungen.zeitpunkt, bis),
        isNull(nachfolger.stempelId),
        eq(stempelungen.entfernt, false),
      ),
    )
    .all();

/** When each stamp in force was recorded by the server, by art and instant */
const erfasstJeStempel = (zeilen: readonly { art: string; zeitpunkt: number; am: number }[]) => {
  const je = new Map<string, number>();
  for (const { art, zeitpunkt, am } of zeilen) {
    const k = schluessel(art, zeitpunkt);
    je.set(k, Math.max(je.get(k) ?? 0, am));
  }
  return je;
};

const ZWEI_TAGE = 2 * 86_400_000;

/** The working day of each stamp the months record (a night shift's Gehen belongs to its start) */
const arbeitstagJeStempel = (monate: readonly MonatStatus[]) =>
  new Map(
    monate.flatMap((status) =>
      status.inhalt.tage.flatMap((auf) =>
        auf.stempel.map(([art, zeitpunkt]) => [schluessel(art, zeitpunkt), auf.tag] as const),
      ),
    ),
  );

/**
 * The day a change belongs to: the working day of the stamp it left in force, else (a removal, or
 * a stamp replaced later) the working day that stamp would have among the stamps in force now, as
 * the day view files it: a night shift's Gehen after midnight removed belongs to the day the shift
 * began (tag.ts; CLAUDE.md, "Time")
 */
const tagDerAenderung = (
  aenderung: Aenderung,
  arbeitstagVon: ReadonlyMap<string, Tag>,
  inKraft: readonly Stempelung[],
): Tag => {
  const stempel = aenderung.nachher ?? aenderung.vorher;
  if (stempel === null) return tagInBerlin(0);
  const tag = arbeitstagVon.get(schluessel(stempel.art, stempel.zeitpunkt));
  if (tag !== undefined) return tag;
  const probe = { art: stempel.art, zeitpunkt: stempel.zeitpunkt };
  return (
    stempeltage([...inKraft, probe]).get(stempelSchluessel(probe)) ?? tagInBerlin(probe.zeitpunkt)
  );
};

type Angaben = {
  von: Tag;
  bis: Tag;
  jetzt: number;
  /** the names of who changed what */
  name: (nutzerId: string) => string;
};

/** The days of one month inside the period, with minutes and findings */
const tageDesMonats = (status: MonatStatus, angaben: Angaben, erfasst: Map<string, number>) => {
  const { inhalt } = status;
  // with the call-outs joined in, each day shows the Ist (S-505)
  const werte = tageswerteDesInhalts(inhalt.tage, status.abschluss?.am ?? angaben.jetzt);
  return inhalt.tage
    .filter((auf) => auf.tag >= angaben.von && auf.tag <= angaben.bis)
    .map((auf): PruefTag => {
      const tag = werte(auf);
      const zeiten = auf.stempel.map(([art, zeitpunkt]) => erfasst.get(schluessel(art, zeitpunkt)));
      const bekannt = zeiten.filter((am): am is number => am !== undefined);
      return {
        tag: auf.tag,
        // an open shift has no beginning in the working day: its first stamp is shown all the same
        beginn: tag.beginn ?? auf.stempel[0]?.[1] ?? null,
        ende: tag.ende,
        pauseMinuten: tag.pauseMinuten,
        arbeitsMinuten: tag.arbeitsMinuten,
        erfasstAm: bekannt.length === 0 ? null : Math.max(...bekannt),
        aenderungen: [],
        befunde: inhalt.befunde
          .filter((befund) => befund.tage.includes(auf.tag))
          .map(({ regel, norm, schwere }) => ({ regel, norm, schwere })),
        gegeneintraege: [],
      };
    });
};

/** A person's Prüfexport: the days with a stamp, a change, a counter-entry or a finding */
export const pruefexportPerson = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  angaben: Angaben & { person: string },
): PruefPerson => {
  // two days either side: a night shift's stamps and its working day lie on different days
  const fenster = {
    von: beginnInBerlin(angaben.von) - ZWEI_TAGE,
    bis: beginnInBerlin(plusTage(angaben.bis, 1)) + ZWEI_TAGE,
  };
  const inKraft = stempelInKraft(db, betriebId, nutzerId, fenster.von, fenster.bis);
  const erfasst = erfasstJeStempel(inKraft);
  const monate = monateIm(angaben.von, angaben.bis).map((monat) =>
    monatStatus(db, betriebId, nutzerId, monat, angaben.jetzt),
  );
  const arbeitstagVon = arbeitstagJeStempel(monate);
  const aenderungen = aenderungenIn(db, betriebId, nutzerId, fenster.von, fenster.bis).map((a) => ({
    ...a,
    tag: tagDerAenderung(a, arbeitstagVon, inKraft),
  }));
  const gegeneintraege = monate.flatMap((status) =>
    gegeneintraegeVon(db, betriebId, nutzerId, { monat: status.monat }),
  );
  const tage = monate
    .flatMap((status) => tageDesMonats(status, angaben, erfasst))
    .map((tag) => ({
      ...tag,
      aenderungen: aenderungen
        .filter((a) => a.tag === tag.tag)
        .map(({ tag: _, ...a }) => ({ ...a, von: angaben.name(a.von) })),
      gegeneintraege: gegeneintraege
        .filter((g) => g.tag === tag.tag)
        .map((g) => ({ minuten: g.minuten, grund: g.grund, von: angaben.name(g.von), am: g.am })),
    }))
    .filter(
      (tag) =>
        tag.beginn !== null ||
        tag.aenderungen.length + tag.befunde.length + tag.gegeneintraege.length > 0,
    );
  return {
    name: angaben.person,
    tage,
    monate: monate.map((status) => ({
      monat: status.monat,
      pruefwert: status.abschluss?.pruefwert ?? null,
      abgeschlossenAm: status.abschluss?.am ?? null,
    })),
  };
};
