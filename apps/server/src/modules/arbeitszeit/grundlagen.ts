import {
  type Beschaeftigung,
  type SollGrundlagen,
  type Standort,
  type Tag,
  tagesSoll,
  tagInBerlin,
  wochentag,
} from "@soll/arbeitszeit";
import { and, eq, isNotNull, min } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { modellzuordnungen, schichten, stempelungen } from "../../db/schema.ts";
import { betriebLesen } from "../betrieb/index.ts";
import { mitgliedschaftVon } from "../mitglieder/index.ts";
import { standorteLesen } from "../standorte/index.ts";
import { planSollFuerTage } from "./sollquellen.ts";
import { modellabschnitte } from "./zuordnungen.ts";

/*
 * What the Soll of a person's days needs from the database (S-208, S-306, S-401): the place of the
 * holidays, the employment and the models.
 */

/**
 * The holidays of a person come from the business's first site, else from its Land; a site per
 * person follows with the shift plan (docs/plan.md, "Feiertage im Monatsabschluss")
 */
export const standortVon = (db: Db, betriebId: string): Standort | null => {
  const [erster] = standorteLesen(db, betriebId);
  if (erster) return { land: erster.land, regionen: erster.regionen };
  const land = betriebLesen(db, betriebId)?.land;
  return land ? ({ land } as Standort) : null;
};

/**
 * The employment as Soll knows it: from the first of joining the business, the first stamp, the
 * first model and the first published shift; Soll has no date of leaving yet
 */
export const beschaeftigungVon = (
  db: Db,
  betriebId: string,
  nutzerId: string,
): Beschaeftigung | null => {
  const seit = mitgliedschaftVon(db, betriebId, nutzerId)?.seit;
  const ersterStempel = db
    .select({ zeitpunkt: min(stempelungen.zeitpunkt) })
    .from(stempelungen)
    .where(and(eq(stempelungen.betriebId, betriebId), eq(stempelungen.nutzerId, nutzerId)))
    .get()?.zeitpunkt;
  const ersteZuordnung = db
    .select({ tag: min(modellzuordnungen.gueltigAb) })
    .from(modellzuordnungen)
    .where(
      and(eq(modellzuordnungen.betriebId, betriebId), eq(modellzuordnungen.nutzerId, nutzerId)),
    )
    .get()?.tag;
  const ersteSchicht = db
    .select({ tag: min(schichten.tag) })
    .from(schichten)
    .where(
      and(
        eq(schichten.betriebId, betriebId),
        eq(schichten.nutzerId, nutzerId),
        isNotNull(schichten.veroeffentlichtAm),
      ),
    )
    .get()?.tag;
  const tage = [
    seit == null ? null : tagInBerlin(seit),
    ersterStempel == null ? null : tagInBerlin(ersterStempel),
    ersteZuordnung ?? null,
    ersteSchicht ?? null,
  ].filter((tag): tag is Tag => tag !== null);
  const [eintritt] = tage.sort();
  return eintritt === undefined ? null : { eintritt };
};

/** Place, employment, models and (for `tage`) plan-based Soll of a person; null while unknown */
export const sollGrundlagen = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  tage?: readonly Tag[],
): SollGrundlagen | null => {
  const standort = standortVon(db, betriebId);
  const beschaeftigung = beschaeftigungVon(db, betriebId, nutzerId);
  if (standort === null || beschaeftigung === null) return null;
  const plan = tage ? planSollFuerTage(db, betriebId, nutzerId, tage) : undefined;
  return {
    standort,
    beschaeftigung,
    modelle: modellabschnitte(db, betriebId, nutzerId),
    ...(plan && plan.size > 0 ? { plan } : {}),
  };
};

/**
 * Whether a day is a working day of the person, for the day a certificate is due (§ 5 Abs. 1 Satz 2
 * EntgFG, R-27): a day with Soll in the model, so neither a holiday nor a day off; without a model
 * or holidays Monday to Friday, the days a model of five days has
 */
export const arbeitstagVon =
  (grundlagen: SollGrundlagen | null) =>
  (tag: Tag): boolean => {
    const soll = grundlagen === null ? null : tagesSoll(tag, grundlagen);
    if (soll?.ok) return soll.wert.sollMinuten > 0;
    return wochentag(tag) >= 1 && wochentag(tag) <= 5;
  };
