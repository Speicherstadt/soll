import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { projektzeiten } from "../../db/schema.ts";
import type { Kontext, Schreiber } from "../audit/index.ts";
import { ueberschneidende } from "./buchungen-lesen.ts";
import { kundenLesen } from "./kunden.ts";
import { projekteLesen } from "./projekte.ts";
import { taetigkeitenLesen } from "./taetigkeiten.ts";

/*
 * Customers and orders taken over from another tool (S-701), and bookings made from the project and
 * activity of a time in a spreadsheet (S-702), written by an import in its one transaction with the
 * import, the tool and their id there (`extern_quelle`, `extern_id`, S-601).
 */

export type Herkunft = { importId: string; quelle: string };

export type UebernommenerKunde = {
  kundeId: string;
  name: string;
  nummer: string;
  externId: string;
};
export type UebernommenesProjekt = UebernommenerKunde & { projektId: string };

export const kundenUebernehmen = (
  s: Schreiber,
  kontext: Kontext,
  herkunft: Herkunft,
  neue: readonly UebernommenerKunde[],
): void => {
  for (const kunde of neue)
    s.einfuegen("kunden", {
      betriebId: kontext.betriebId,
      kundeId: kunde.kundeId,
      name: kunde.name,
      nummer: kunde.nummer,
      externQuelle: herkunft.quelle,
      externId: kunde.externId,
      angelegtAm: kontext.jetzt,
      importId: herkunft.importId,
    });
};

export const projekteUebernehmen = (
  s: Schreiber,
  kontext: Kontext,
  herkunft: Herkunft,
  neue: readonly UebernommenesProjekt[],
): void => {
  for (const projekt of neue)
    s.einfuegen("projekte", {
      betriebId: kontext.betriebId,
      projektId: projekt.projektId,
      kundeId: projekt.kundeId,
      name: projekt.name,
      nummer: projekt.nummer,
      externQuelle: herkunft.quelle,
      externId: projekt.externId,
      angelegtAm: kontext.jetzt,
      importId: herkunft.importId,
    });
};

/** A booking of a span of work taken over: on the working day of its time (S-702) */
export type UebernommeneBuchung = {
  nutzerId: string;
  projektId: string | null;
  taetigkeitId: string;
  beginn: number;
  ende: number;
  tag: string;
  externId: string;
};

export const buchungenUebernehmen = (
  s: Schreiber,
  kontext: Kontext,
  herkunft: Herkunft,
  neue: readonly UebernommeneBuchung[],
): void => {
  for (const buchung of neue)
    s.einfuegen("projektzeiten", {
      betriebId: kontext.betriebId,
      buchungId: crypto.randomUUID(),
      nutzerId: buchung.nutzerId,
      projektId: buchung.projektId,
      taetigkeitId: buchung.taetigkeitId,
      beginn: buchung.beginn,
      ende: buchung.ende,
      tag: buchung.tag,
      notiz: "",
      angelegtAm: kontext.jetzt,
      importId: herkunft.importId,
      externQuelle: herkunft.quelle,
      externId: buchung.externId,
    });
};

/** The ids in the old tool of the bookings a tool's imports wrote */
export const uebernommeneBuchungen = (db: Db, betriebId: string, quelle: string): Set<string> =>
  new Set(
    db
      .select({ externId: projektzeiten.externId })
      .from(projektzeiten)
      .where(
        and(
          eq(projektzeiten.betriebId, betriebId),
          eq(projektzeiten.externQuelle, quelle),
          isNotNull(projektzeiten.externId),
        ),
      )
      .all()
      .map((zeile) => zeile.externId as string),
  );

/** Whether a span overlaps a booking of the person there already (also a running stopwatch) */
export const buchungUeberschneidet = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  spanne: { beginn: number; ende: number },
): boolean => ueberschneidende(db, betriebId, nutzerId, spanne, null) !== undefined;

export type BuchbaresProjekt = { projektId: string; name: string; nummer: string; kunde: string };
export type BuchbareTaetigkeit = { taetigkeitId: string; name: string; fest: boolean };

/**
 * What a booking may be on now: orders whose customer and they are not archived, and activities not
 * archived (`bezugPruefen`, S-601)
 */
export const buchbar = (
  db: Db,
  betriebId: string,
): { projekte: BuchbaresProjekt[]; taetigkeiten: BuchbareTaetigkeit[] } => {
  const kunden = new Map(kundenLesen(db, betriebId).map((k) => [k.kundeId, k]));
  return {
    projekte: projekteLesen(db, betriebId).flatMap((p) => {
      const kunde = kunden.get(p.kundeId);
      return p.archiviertAm === null && kunde && kunde.archiviertAm === null
        ? [{ projektId: p.projektId, name: p.name, nummer: p.nummer, kunde: kunde.name }]
        : [];
    }),
    taetigkeiten: taetigkeitenLesen(db, betriebId)
      .filter((t) => t.archiviertAm === null)
      .map(({ taetigkeitId, name, fest }) => ({ taetigkeitId, name, fest })),
  };
};
