import { FESTE_TAETIGKEITEN, istFesteTaetigkeit } from "@soll/arbeitszeit";
import { and, eq } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { stundensaetze, taetigkeiten } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import {
  archivWert,
  type Ergebnis,
  type Extern,
  eindeutig,
  externWerte,
  gesetzt,
  nein,
  ok,
} from "./ergebnis.ts";

type Zeile = typeof taetigkeiten.$inferSelect;

/** An activity as the API shows it: `fest` for the four of Soll, which have no name of their own */
export type Taetigkeit = Omit<Zeile, "betriebId" | "angelegtAm"> & { fest: boolean };

export type NeueTaetigkeit = Extern & { name: string; abrechenbar?: boolean | undefined };
export type TaetigkeitAenderung = {
  name?: string | undefined;
  abrechenbar?: boolean | undefined;
  archiviert?: boolean | undefined;
};

const alsTaetigkeit = ({ betriebId: _b, angelegtAm: _a, ...zeile }: Zeile): Taetigkeit => ({
  ...zeile,
  fest: istFesteTaetigkeit(zeile.taetigkeitId),
});

/** A fixed activity before the business changed anything: internal time, not billed */
const festeVorgabe = (taetigkeitId: string): Taetigkeit => ({
  taetigkeitId,
  name: "",
  abrechenbar: false,
  externQuelle: null,
  externId: null,
  archiviertAm: null,
  fest: true,
});

const zeilenLesen = (db: Db, betriebId: string): Zeile[] =>
  db
    .select()
    .from(taetigkeiten)
    .where(eq(taetigkeiten.betriebId, betriebId))
    .orderBy(taetigkeiten.name, taetigkeiten.angelegtAm)
    .all();

/** The four fixed activities first, always, then the business's own */
export const taetigkeitenLesen = (db: Db, betriebId: string): Taetigkeit[] => {
  const zeilen = zeilenLesen(db, betriebId);
  const gespeichert = new Map(zeilen.map((zeile) => [zeile.taetigkeitId, zeile]));
  return [
    ...FESTE_TAETIGKEITEN.map((id) => {
      const zeile = gespeichert.get(id);
      return zeile ? alsTaetigkeit(zeile) : festeVorgabe(id);
    }),
    ...zeilen.filter((zeile) => !istFesteTaetigkeit(zeile.taetigkeitId)).map(alsTaetigkeit),
  ];
};

export const taetigkeitLesen = (
  db: Db,
  betriebId: string,
  taetigkeitId: string,
): Taetigkeit | undefined => {
  const zeile = db
    .select()
    .from(taetigkeiten)
    .where(and(eq(taetigkeiten.betriebId, betriebId), eq(taetigkeiten.taetigkeitId, taetigkeitId)))
    .get();
  if (zeile) return alsTaetigkeit(zeile);
  return istFesteTaetigkeit(taetigkeitId) ? festeVorgabe(taetigkeitId) : undefined;
};

export const taetigkeitAnlegen = (schreibDb: SchreibDb, kontext: Kontext, neu: NeueTaetigkeit) =>
  eindeutig(() =>
    alsTaetigkeit(
      schreiben(schreibDb, kontext, (s) =>
        s.einfuegen("taetigkeiten", {
          betriebId: kontext.betriebId,
          taetigkeitId: crypto.randomUUID(),
          name: neu.name,
          abrechenbar: neu.abrechenbar ?? true,
          ...externWerte(neu),
          angelegtAm: kontext.jetzt,
        }),
      ),
    ),
  );

/** Billing a fixed activity: its row is written the first time the business changes it */
const festeAendern = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  taetigkeitId: string,
  abrechenbar: boolean,
): Taetigkeit =>
  alsTaetigkeit(
    schreiben(schreibDb, kontext, (s) =>
      zeilenLesen(db, kontext.betriebId).some((zeile) => zeile.taetigkeitId === taetigkeitId)
        ? s.aendern("taetigkeiten", { taetigkeitId }, { abrechenbar })
        : s.einfuegen("taetigkeiten", {
            betriebId: kontext.betriebId,
            taetigkeitId,
            name: "",
            abrechenbar,
            angelegtAm: kontext.jetzt,
          }),
    ),
  );

/** A fixed activity takes only `abrechenbar`; a name or the archive is refused (`fest`) */
export const taetigkeitAendern = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  taetigkeitId: string,
  aenderung: TaetigkeitAenderung,
): Ergebnis<Taetigkeit> => {
  const vorhanden = taetigkeitLesen(db, kontext.betriebId, taetigkeitId);
  if (!vorhanden) return nein("unbekannt");
  const { archiviert, ...felder } = aenderung;
  if (vorhanden.fest) {
    if (felder.name !== undefined || archiviert !== undefined) return nein("fest");
    const abrechenbar = felder.abrechenbar ?? vorhanden.abrechenbar;
    return ok(festeAendern(db, schreibDb, kontext, taetigkeitId, abrechenbar));
  }
  return ok(
    alsTaetigkeit(
      schreiben(schreibDb, kontext, (s) =>
        s.aendern(
          "taetigkeiten",
          { taetigkeitId },
          { ...gesetzt(felder), ...archivWert(archiviert, kontext.jetzt) },
        ),
      ),
    ),
  );
};

/** Removes an own activity no rate names; a fixed one stays (`fest`), a used one is archived */
export const taetigkeitEntfernen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  taetigkeitId: string,
): Ergebnis<null> => {
  const vorhanden = taetigkeitLesen(db, kontext.betriebId, taetigkeitId);
  if (!vorhanden) return nein("unbekannt");
  if (vorhanden.fest) return nein("fest");
  const satz = db
    .select({ id: stundensaetze.satzId })
    .from(stundensaetze)
    .where(
      and(
        eq(stundensaetze.betriebId, kontext.betriebId),
        eq(stundensaetze.taetigkeitId, taetigkeitId),
      ),
    )
    .get();
  if (satz) return nein("verwendet");
  schreiben(schreibDb, kontext, (s) => s.loeschen("taetigkeiten", { taetigkeitId }));
  return ok(null);
};
