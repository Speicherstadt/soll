import { type Monat, monatVon } from "@soll/arbeitszeit";
import type { ImportDaten, Zuordnung } from "@soll/import";
import {
  abwesenheitPlanen,
  type GenommeneAbwesenheiten,
  monateZwischen,
} from "./plan-abwesenheiten.ts";
import { type Ergebnis, kundePlanen, projektPlanen, zaehlen } from "./plan-projekte.ts";
import {
  type Art,
  keineZahlen,
  type Monatssperre,
  type Plan,
  type PlanGrund,
  type Stand,
} from "./plan-typen.ts";
import { type Genommen, stempelKennung, zeitPlanen } from "./plan-zeiten.ts";

/*
 * The plan of a takeover from the records of a file, the owner's mapping and the business as it
 * stands (BAULISTE.md S-701). Pure: what it reads comes in with `Stand`, so the dry run and the
 * takeover compute the same plan, and Vitest checks every rule without a database.
 */

type Satz = { zeile: number; externalId: string };

/** The plan being built, with the months each person's records reach */
type Bau = Plan & { beruehrt: Map<string, Set<Monat>> };

const ablehnen = (bau: Bau, art: Art, satz: Satz, grund: PlanGrund) => {
  bau.zahlen[art].abgelehnt += 1;
  bau.abgelehnt.push({ art, zeile: satz.zeile, externalId: satz.externalId, grund });
};

const beruehren = (bau: Bau, nutzerId: string, monate: readonly Monat[]) => {
  const bisher = bau.beruehrt.get(nutzerId) ?? new Set<Monat>();
  for (const monat of monate) bisher.add(monat);
  bau.beruehrt.set(nutzerId, bisher);
};

/** The member of a record's person, or what becomes of the record without one */
const personVon = (
  bau: Bau,
  art: Art,
  satz: Satz & { person: string },
  zuordnung: Zuordnung,
  stand: Stand,
): string | null => {
  const nutzerId = zuordnung.personen[satz.person] ?? null;
  if (nutzerId === null) bau.zahlen[art].ausgelassen += 1;
  else if (!stand.mitglieder.has(nutzerId)) ablehnen(bau, art, satz, "person_unbekannt");
  else if (!stand.module.arbeitszeit) ablehnen(bau, art, satz, "modul_aus");
  else return nutzerId;
  return null;
};

const zeitenPlanen = (bau: Bau, daten: ImportDaten, zuordnung: Zuordnung, stand: Stand) => {
  const genommen: Genommen = new Map();
  for (const zeit of daten.zeiten) {
    const nutzerId = personVon(bau, "zeiten", zeit, zuordnung, stand);
    if (nutzerId === null) continue;
    beruehren(bau, nutzerId, [monatVon(zeit.tag)]);
    if (stand.vorhanden.stempelungen.has(stempelKennung(zeit.externalId, "kommen"))) {
      bau.zahlen.zeiten.vorhanden += 1;
      continue;
    }
    const ergebnis = zeitPlanen(zeit, nutzerId, stand, genommen);
    if (typeof ergebnis === "string") ablehnen(bau, "zeiten", zeit, ergebnis);
    else {
      bau.zahlen.zeiten.neu += 1;
      bau.stempelungen.push(...ergebnis);
    }
  }
};

const abwesenheitenPlanen = (bau: Bau, daten: ImportDaten, zuordnung: Zuordnung, stand: Stand) => {
  const genommen: GenommeneAbwesenheiten = new Map();
  for (const satz of daten.abwesenheiten) {
    const art = zuordnung.arten[satz.art] ?? null;
    const nutzerId = art === null ? null : personVon(bau, "abwesenheiten", satz, zuordnung, stand);
    if (art === null) bau.zahlen.abwesenheiten.ausgelassen += 1;
    if (art === null || nutzerId === null) continue;
    beruehren(bau, nutzerId, monateZwischen(satz.von, satz.bis));
    if (stand.vorhanden.abwesenheiten.has(satz.externalId)) {
      bau.zahlen.abwesenheiten.vorhanden += 1;
      continue;
    }
    const ergebnis = abwesenheitPlanen(satz, { nutzerId, art }, stand, genommen);
    if (typeof ergebnis === "string") ablehnen(bau, "abwesenheiten", satz, ergebnis);
    else {
      bau.zahlen.abwesenheiten.neu += 1;
      bau.abwesenheiten.push(ergebnis);
    }
  }
};

/** Counts and keeps a customer's or an order's result; the id in Soll, or null */
const uebernehmen = <T>(
  bau: Bau,
  art: "kunden" | "projekte",
  satz: Satz,
  ergebnis: Ergebnis<T>,
): string | null => {
  if (ergebnis.art === "abgelehnt") ablehnen(bau, art, satz, ergebnis.grund);
  else zaehlen(bau.zahlen[art], ergebnis);
  if (ergebnis.art === "neu") (bau[art] as T[]).push(ergebnis.wert);
  return ergebnis.art === "neu" || ergebnis.art === "vorhanden" ? ergebnis.id : null;
};

const projekteUndKundenPlanen = (
  bau: Bau,
  daten: ImportDaten,
  zuordnung: Zuordnung,
  stand: Stand,
) => {
  const kundeVon = new Map<string, string | null>();
  for (const kunde of daten.kunden) {
    const ergebnis = kundePlanen(kunde, zuordnung.kunden[kunde.externalId] ?? "neu", stand);
    kundeVon.set(kunde.externalId, uebernehmen(bau, "kunden", kunde, ergebnis));
  }
  for (const projekt of daten.projekte) {
    const ziel = zuordnung.projekte[projekt.externalId] ?? "neu";
    const kundeId = kundeVon.get(projekt.kunde) ?? null;
    uebernehmen(bau, "projekte", projekt, projektPlanen(projekt, ziel, kundeId, stand));
  }
};

/** The months up to `bis` a person's records reach that are not closed in Soll yet */
const zuSperren = (bau: Bau, bis: Monat | null, stand: Stand): Monatssperre[] =>
  bis === null
    ? []
    : [...bau.beruehrt].flatMap(([nutzerId, monate]) =>
        [...monate]
          .filter((monat) => monat <= bis && !stand.geschlossen(nutzerId).has(monat))
          .sort()
          .map((monat) => ({ nutzerId, monat })),
      );

export const planen = (
  daten: ImportDaten,
  zuordnung: Zuordnung,
  abgeschlossenBis: Monat | null,
  stand: Stand,
): Plan => {
  const bau: Bau = {
    stempelungen: [],
    abwesenheiten: [],
    kunden: [],
    projekte: [],
    monate: [],
    zahlen: keineZahlen(),
    abgelehnt: [],
    beruehrt: new Map(),
  };
  projekteUndKundenPlanen(bau, daten, zuordnung, stand);
  zeitenPlanen(bau, daten, zuordnung, stand);
  abwesenheitenPlanen(bau, daten, zuordnung, stand);
  const { beruehrt: _, ...plan } = bau;
  return {
    ...plan,
    monate: zuSperren(bau, abgeschlossenBis, stand),
    abgelehnt: plan.abgelehnt.sort((a, b) => a.zeile - b.zeile),
  };
};
