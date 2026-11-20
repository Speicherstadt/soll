import { type SatzErgebnis, stundensatz, tagInBerlin } from "@soll/arbeitszeit";
import { and, eq } from "drizzle-orm";
import { darf } from "../../auth/rollen.ts";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { stundensaetze } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { mitgliedschaftVon } from "../mitglieder/index.ts";
import { type Ergebnis, eindeutig, type Grund, nein, ok } from "./ergebnis.ts";
import { kundeLesen } from "./kunden.ts";
import { projektLesen } from "./projekte.ts";
import { taetigkeitLesen } from "./taetigkeiten.ts";

type Zeile = typeof stundensaetze.$inferSelect;

/** A rate as the API shows it, without the key that only keeps it unique */
export type Stundensatz = Omit<Zeile, "betriebId" | "schluessel">;

/** What a rate names: one of order or customer at most, since the order belongs to a customer */
export type SatzBezug = {
  kundeId: string | null;
  projektId: string | null;
  taetigkeitId: string | null;
  nutzerId: string | null;
};

export type NeuerSatz = SatzBezug & { gueltigAb?: string | undefined; centProStunde: number };

const alsSatz = ({ betriebId: _b, schluessel: _s, ...satz }: Zeile): Stundensatz => satz;

export const saetzeLesen = (db: Db, betriebId: string): Stundensatz[] =>
  db
    .select()
    .from(stundensaetze)
    .where(eq(stundensaetze.betriebId, betriebId))
    .orderBy(stundensaetze.gueltigAb, stundensaetze.angelegtAm)
    .all()
    .map(alsSatz);

/** Whether a member books project time (S-602), as GET /saetze/personen lists them: not a device */
const bucht = (db: Db, betriebId: string, nutzerId: string): boolean => {
  const mitglied = mitgliedschaftVon(db, betriebId, nutzerId);
  return mitglied !== undefined && darf(mitglied.rolle, "projekte:lesen");
};

/** Whether a row a rate names is known to the business and not archived, or why not */
const bezugPruefen = (db: Db, betriebId: string, bezug: SatzBezug): Grund | null => {
  const pruefungen: [
    string | null,
    Grund,
    (id: string) => { archiviertAm: number | null } | undefined,
  ][] = [
    [bezug.kundeId, "kunde_unbekannt", (id) => kundeLesen(db, betriebId, id)],
    [bezug.projektId, "projekt_unbekannt", (id) => projektLesen(db, betriebId, id)],
    [bezug.taetigkeitId, "taetigkeit_unbekannt", (id) => taetigkeitLesen(db, betriebId, id)],
    [
      bezug.nutzerId,
      "person_unbekannt",
      (id) => (bucht(db, betriebId, id) ? { archiviertAm: null } : undefined),
    ],
  ];
  for (const [id, unbekannt, lesen] of pruefungen) {
    if (id === null) continue;
    const zeile = lesen(id);
    if (!zeile) return unbekannt;
    if (zeile.archiviertAm !== null) return "archiviert";
  }
  return null;
};

export const satzAnlegen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  neu: NeuerSatz,
): Ergebnis<Stundensatz> => {
  const grund = bezugPruefen(db, kontext.betriebId, neu);
  if (grund) return nein(grund);
  const gueltigAb = neu.gueltigAb ?? tagInBerlin(kontext.jetzt);
  const bezug = [neu.kundeId, neu.projektId, neu.taetigkeitId, neu.nutzerId];
  return eindeutig(() =>
    alsSatz(
      schreiben(schreibDb, kontext, (s) =>
        s.einfuegen("stundensaetze", {
          betriebId: kontext.betriebId,
          satzId: crypto.randomUUID(),
          kundeId: neu.kundeId,
          projektId: neu.projektId,
          taetigkeitId: neu.taetigkeitId,
          nutzerId: neu.nutzerId,
          gueltigAb,
          centProStunde: neu.centProStunde,
          schluessel: JSON.stringify([...bezug, gueltigAb]),
          angelegtAm: kontext.jetzt,
        }),
      ),
    ),
  );
};

/** Removes a rate; a booking keeps the rate it was billed with (S-602), so nothing names it */
export const satzEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  satzId: string,
): Ergebnis<null> => {
  const vorhanden = db
    .select({ id: stundensaetze.satzId })
    .from(stundensaetze)
    .where(and(eq(stundensaetze.betriebId, kontext.betriebId), eq(stundensaetze.satzId, satzId)))
    .get();
  if (!vorhanden) return nein("unbekannt");
  schreiben(schreibDb, kontext, (s) => s.loeschen("stundensaetze", { satzId }));
  return ok(null);
};

/**
 * The rate in force for a booking: an order of the business (its customer comes with it), an
 * activity of the business, a person and a day
 */
export const satzFuer = (
  db: Db,
  betriebId: string,
  anfrage: { projektId: string | null; taetigkeitId: string; nutzerId: string; tag: string },
): Ergebnis<SatzErgebnis> => {
  const projekt =
    anfrage.projektId === null ? null : projektLesen(db, betriebId, anfrage.projektId);
  if (projekt === undefined) return nein("projekt_unbekannt");
  if (!taetigkeitLesen(db, betriebId, anfrage.taetigkeitId)) return nein("taetigkeit_unbekannt");
  const saetze = saetzeLesen(db, betriebId);
  return ok(
    stundensatz(saetze, {
      ...anfrage,
      projektId: projekt?.projektId ?? null,
      kundeId: projekt?.kundeId ?? null,
    }),
  );
};
