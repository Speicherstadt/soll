import { type Monat, monatVon } from "@soll/arbeitszeit";
import type { ImportDaten, ImportZeit, Zuordnung } from "@soll/import";
import {
  abwesenheitPlanen,
  type GenommeneAbwesenheiten,
  monateZwischen,
} from "./plan-abwesenheiten.ts";
import { buchungenPlanen, buchungenWieder } from "./plan-buchungen.ts";
import {
  type Bezugsids,
  type GenommeneBuchungen,
  toolBuchungPlanen,
} from "./plan-buchungen-tool.ts";
import {
  type Ergebnis,
  kundePlanen,
  projektPlanen,
  taetigkeitPlanen,
  zaehlen,
} from "./plan-projekte.ts";
import {
  type Art,
  keineZahlen,
  type Monatssperre,
  type NeueStempelung,
  type Plan,
  type PlanArt,
  type PlanGrund,
  type Stand,
} from "./plan-typen.ts";
import { abwesenheitWieder, type Wiederfund, zeitWieder } from "./plan-wieder.ts";
import { type Genommen, zeitPlanen } from "./plan-zeiten.ts";

/*
 * The plan of a takeover from the records of a file, the owner's mapping and the business as it
 * stands (BAULISTE.md S-701). Pure: what it reads comes in with `Stand`, so the dry run and the
 * takeover compute the same plan, and Vitest checks every rule without a database.
 */

type Satz = { zeile: number; externalId: string };

/**
 * The plan being built, with the months each person's records reach that are taken over now or
 * were before: only those may be closed as taken over (a refused record closes nothing, S-306)
 */
type Bau = Plan & { beruehrt: Map<string, Set<Monat>> };

const ablehnen = (bau: Bau, art: PlanArt, satz: Satz, grund: PlanGrund) => {
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

/**
 * A record an earlier import took over (plan-wieder.ts): there already, its months those of the row
 * in Soll; reported with its line when that row says something else now
 */
const schonDa = (
  bau: Bau,
  art: "zeiten" | "abwesenheiten",
  satz: Satz,
  nutzerId: string,
  fund: Wiederfund,
) => {
  if ("grund" in fund) return ablehnen(bau, art, satz, fund.grund);
  bau.zahlen[art].vorhanden += 1;
  beruehren(bau, nutzerId, fund.monate);
};

/** The bookings of a time that becomes stamps now (S-702) */
const buchungenVon = (
  bau: Bau,
  zeit: ImportZeit,
  nutzerId: string,
  stempel: readonly NeueStempelung[],
  kontext: { zuordnung: Zuordnung; stand: Stand },
) => {
  const ergebnis = buchungenPlanen(zeit, nutzerId, stempel, kontext.zuordnung, kontext.stand);
  if (ergebnis.art === "abgelehnt") ablehnen(bau, "buchungen", zeit, ergebnis.grund);
  else if (ergebnis.art === "ausgelassen") bau.zahlen.buchungen.ausgelassen += 1;
  else if (ergebnis.art === "neu") {
    bau.zahlen.buchungen.neu += 1;
    bau.buchungen.push(...ergebnis.buchungen);
  }
};

const zeitenPlanen = (bau: Bau, daten: ImportDaten, zuordnung: Zuordnung, stand: Stand) => {
  const genommen: Genommen = new Map();
  for (const zeit of daten.zeiten) {
    const nutzerId = personVon(bau, "zeiten", zeit, zuordnung, stand);
    if (nutzerId === null) continue;
    const fund = zeitWieder(zeit, nutzerId, stand.vorhanden.stempelungen);
    if (fund !== null) {
      schonDa(bau, "zeiten", zeit, nutzerId, fund);
      const wieder = "grund" in fund ? "keine" : buchungenWieder(zeit, stand);
      if (wieder !== "keine") bau.zahlen.buchungen[wieder] += 1;
      continue;
    }
    const ergebnis = zeitPlanen(zeit, nutzerId, stand, genommen);
    if (typeof ergebnis === "string") ablehnen(bau, "zeiten", zeit, ergebnis);
    else {
      bau.zahlen.zeiten.neu += 1;
      bau.stempelungen.push(...ergebnis);
      beruehren(bau, nutzerId, [monatVon(zeit.tag)]);
      buchungenVon(bau, zeit, nutzerId, ergebnis, { zuordnung, stand });
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
    const fund = abwesenheitWieder(satz, { nutzerId, art }, stand.vorhanden.abwesenheiten);
    if (fund !== null) {
      schonDa(bau, "abwesenheiten", satz, nutzerId, fund);
      continue;
    }
    const ergebnis = abwesenheitPlanen(satz, { nutzerId, art }, stand, genommen);
    if (typeof ergebnis === "string") ablehnen(bau, "abwesenheiten", satz, ergebnis);
    else {
      bau.zahlen.abwesenheiten.neu += 1;
      bau.abwesenheiten.push(ergebnis);
      beruehren(bau, nutzerId, monateZwischen(satz.von, satz.bis));
    }
  }
};

/** Counts and keeps a customer's or an order's result; the id in Soll, or null */
const uebernehmen = <T>(
  bau: Bau,
  art: "kunden" | "projekte" | "taetigkeiten",
  satz: Satz,
  ergebnis: Ergebnis<T>,
): string | null => {
  if (ergebnis.art === "abgelehnt") ablehnen(bau, art, satz, ergebnis.grund);
  else zaehlen(bau.zahlen[art], ergebnis);
  if (ergebnis.art === "neu") (bau[art] as T[]).push(ergebnis.wert);
  return ergebnis.art === "neu" || ergebnis.art === "vorhanden" ? ergebnis.id : null;
};

/** Customers, orders and activities; the ids in Soll of the orders and activities (S-705) */
const projekteUndKundenPlanen = (
  bau: Bau,
  daten: ImportDaten,
  zuordnung: Zuordnung,
  stand: Stand,
): Bezugsids => {
  const kundeVon = new Map<string, string | null>();
  for (const kunde of daten.kunden) {
    const ergebnis = kundePlanen(kunde, zuordnung.kunden[kunde.externalId] ?? "neu", stand);
    kundeVon.set(kunde.externalId, uebernehmen(bau, "kunden", kunde, ergebnis));
  }
  const projekte = new Map<string, string | null>();
  for (const projekt of daten.projekte) {
    const ziel = zuordnung.projekte[projekt.externalId] ?? "neu";
    const kundeId = kundeVon.get(projekt.kunde) ?? null;
    const ergebnis = projektPlanen(projekt, ziel, kundeId, stand);
    projekte.set(projekt.externalId, uebernehmen(bau, "projekte", projekt, ergebnis));
  }
  const taetigkeiten = new Map<string, string | null>();
  for (const taetigkeit of daten.taetigkeiten) {
    const ziel = zuordnung.taetigkeiten?.[taetigkeit.externalId] ?? "neu";
    const ergebnis = taetigkeitPlanen(taetigkeit, ziel, stand);
    taetigkeiten.set(taetigkeit.externalId, uebernehmen(bau, "taetigkeiten", taetigkeit, ergebnis));
  }
  return { projekte, taetigkeiten };
};

/** The bookings the old tool kept itself (S-705), on the orders and activities planned before */
const toolBuchungenPlanen = (
  bau: Bau,
  daten: ImportDaten,
  kontext: { zuordnung: Zuordnung; stand: Stand; ids: Bezugsids },
) => {
  const genommen: GenommeneBuchungen = new Map();
  for (const satz of daten.buchungen) {
    const ergebnis = toolBuchungPlanen(satz, { ...kontext, genommen });
    if (ergebnis.art === "abgelehnt") ablehnen(bau, "buchungen", satz, ergebnis.grund);
    else bau.zahlen.buchungen[ergebnis.art] += 1;
    if (ergebnis.art === "neu") bau.buchungen.push(ergebnis.buchung);
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
    taetigkeiten: [],
    buchungen: [],
    monate: [],
    zahlen: keineZahlen(),
    abgelehnt: [],
    beruehrt: new Map(),
  };
  const ids = projekteUndKundenPlanen(bau, daten, zuordnung, stand);
  zeitenPlanen(bau, daten, zuordnung, stand);
  toolBuchungenPlanen(bau, daten, { zuordnung, stand, ids });
  abwesenheitenPlanen(bau, daten, zuordnung, stand);
  const { beruehrt: _, ...plan } = bau;
  return {
    ...plan,
    monate: zuSperren(bau, abgeschlossenBis, stand),
    abgelehnt: plan.abgelehnt.sort((a, b) => a.zeile - b.zeile),
  };
};
