import type { DokuStandDaten, DokuTerminal } from "@soll/export";
import { and, asc, count, eq, gt, gte, isNull, or } from "drizzle-orm";
import { ROLLEN, rechteDerRolle, rollenVon } from "../../auth/rollen.ts";
import type { Db } from "../../db/oeffnen.ts";
import {
  apiZugaenge,
  auditKoepfe,
  aussonderungen,
  ausweise,
  datevEinstellungen,
  datevPersonalnummern,
  habenZugaenge,
  karten,
  mitgliedschaften,
  monatsabschluesse,
  pins,
  standorte,
  terminals,
} from "../../db/schema.ts";
import { aktuellerPruefwert, kettePruefen } from "../audit/index.ts";
import { betriebLesen, moduleVon } from "../betrieb/index.ts";
import { angabenAenderungen, angabenLesen } from "./angaben.ts";

/*
 * The live state of one business for its Verfahrensdokumentation (S-902): what it switched on and
 * set up, counts instead of names, and the check of its chain at this moment. Every query filters by
 * the business (CLAUDE.md); nothing secret leaves here, not even a hash.
 */

const rollen = (db: Db, betriebId: string): DokuStandDaten["rollen"] => {
  const gespeichert = db
    .select({ rolle: mitgliedschaften.rolle })
    .from(mitgliedschaften)
    .where(eq(mitgliedschaften.betriebId, betriebId))
    .all()
    .flatMap(({ rolle }) => rollenVon(rolle));
  return ROLLEN.map((rolle) => ({
    rolle,
    mitglieder: gespeichert.filter((teil) => teil === rolle).length,
    rechte: [...rechteDerRolle(rolle)],
  }));
};

const terminalStand = (db: Db, betriebId: string): DokuStandDaten["terminal"] => {
  const liste = db
    .select()
    .from(terminals)
    .where(eq(terminals.betriebId, betriebId))
    .orderBy(asc(terminals.angelegtAm), asc(terminals.terminalId))
    .all()
    .map(
      (t): DokuTerminal => ({
        name: t.name,
        gekoppelt: t.gekoppeltAm !== null,
        widerrufen: t.widerrufenAm !== null,
        offline: t.schluessel !== null,
      }),
    );
  const inGebrauch = db
    .select({ art: karten.art })
    .from(karten)
    .where(and(eq(karten.betriebId, betriebId), isNull(karten.widerrufenAm)))
    .all();
  return {
    terminals: liste,
    karten: {
      uid: inGebrauch.filter(({ art }) => art === "uid").length,
      ntag424: inGebrauch.filter(({ art }) => art === "ntag424").length,
    },
    ausweise: zaehlen(db, ausweise, eq(ausweise.betriebId, betriebId)),
    pins: zaehlen(db, pins, eq(pins.betriebId, betriebId)),
  };
};

type Tabelle = Parameters<ReturnType<Db["select"]>["from"]>[0];

const zaehlen = (db: Db, tabelle: Tabelle, wo: ReturnType<typeof eq> | undefined): number =>
  db.select({ n: count() }).from(tabelle).where(wo).get()?.n ?? 0;

const datev = (db: Db, betriebId: string): DokuStandDaten["datev"] => {
  const zeile = db
    .select()
    .from(datevEinstellungen)
    .where(eq(datevEinstellungen.betriebId, betriebId))
    .get();
  return {
    eingerichtet: zeile !== undefined,
    nummern: Boolean(zeile?.beraterNr && zeile.mandantenNr),
    lohnarten: zeile ? Object.keys(JSON.parse(zeile.lohnarten) as object).length : 0,
    personalnummern: zaehlen(
      db,
      datevPersonalnummern,
      eq(datevPersonalnummern.betriebId, betriebId),
    ),
  };
};

const aufbewahrung = (db: Db, betriebId: string): DokuStandDaten["aufbewahrung"] => {
  const jahre = db
    .select({ jahre: aussonderungen.jahre })
    .from(aussonderungen)
    .where(eq(aussonderungen.betriebId, betriebId))
    .all();
  return {
    abgeschlossen: zaehlen(
      db,
      monatsabschluesse,
      and(
        eq(monatsabschluesse.betriebId, betriebId),
        eq(monatsabschluesse.schritt, "abgeschlossen"),
      ),
    ),
    ausgesondert: {
      zweiJahre: jahre.filter((a) => a.jahre === 2).length,
      achtJahre: jahre.filter((a) => a.jahre === 8).length,
    },
  };
};

/**
 * The tokens that would sign in now, as `tokenAnmelden` decides (routes/zugang-anmeldung.ts): not
 * expired, of a member, made since the current membership began; a revoked token has no row
 */
const gueltigeZugaenge = (db: Db, betriebId: string, jetzt: number): number =>
  db
    .select({ n: count() })
    .from(apiZugaenge)
    .innerJoin(
      mitgliedschaften,
      and(
        eq(mitgliedschaften.betriebId, apiZugaenge.betriebId),
        eq(mitgliedschaften.nutzerId, apiZugaenge.nutzerId),
      ),
    )
    .where(
      and(
        eq(apiZugaenge.betriebId, betriebId),
        or(isNull(apiZugaenge.gueltigBis), gt(apiZugaenge.gueltigBis, jetzt)),
        gte(apiZugaenge.angelegtAm, mitgliedschaften.seit),
      ),
    )
    .get()?.n ?? 0;

const kette = (db: Db, betriebId: string): DokuStandDaten["kette"] => ({
  pruefwert: aktuellerPruefwert(db, betriebId),
  glieder:
    db.select().from(auditKoepfe).where(eq(auditKoepfe.betriebId, betriebId)).get()?.seq ?? 0,
  befunde: kettePruefen(db, betriebId).length,
});

/** The state of a business at `jetzt`; null for a business that does not exist */
export const standLesen = (
  db: Db,
  betriebId: string,
  jetzt: number,
  version: string,
): DokuStandDaten | null => {
  const betrieb = betriebLesen(db, betriebId);
  if (!betrieb) return null;
  const haben = db.select().from(habenZugaenge).where(eq(habenZugaenge.betriebId, betriebId)).get();
  return {
    version,
    betrieb: { name: betrieb.name, land: betrieb.land },
    module: moduleVon(betrieb),
    standorte: db
      .select()
      .from(standorte)
      .where(eq(standorte.betriebId, betriebId))
      .orderBy(asc(standorte.name), asc(standorte.standortId))
      .all()
      .map((s) => ({ name: s.name, land: s.land, regionen: JSON.parse(s.regionen) as string[] })),
    rollen: rollen(db, betriebId),
    apiZugaenge: gueltigeZugaenge(db, betriebId, jetzt),
    kette: kette(db, betriebId),
    aufbewahrung: aufbewahrung(db, betriebId),
    terminal: terminalStand(db, betriebId),
    datev: datev(db, betriebId),
    haben: haben ? { adresse: haben.adresse } : null,
    angaben: angabenLesen(db, betriebId),
    angabenAenderungen: angabenAenderungen(db, betriebId),
  };
};
