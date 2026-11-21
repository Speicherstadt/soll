import type { Striche } from "@soll/arbeitszeit";
import { type Stundennachweis, stundennachweisPdf } from "@soll/export";
import { and, desc, eq, max } from "drizzle-orm";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { stundennachweise } from "../../db/schema.ts";
import { type Kontext, kanonisch, schreiben, sha256 } from "../audit/index.ts";
import { betriebLesen } from "../betrieb/index.ts";
import { type Ergebnis, nein, ok } from "./ergebnis.ts";
import { type Auswahl, nachweisVorschau } from "./nachweis-auswahl.ts";

type Zeile = typeof stundennachweise.$inferSelect;

/** The signature as the request brings it: the preview's `stand`, the remark, the customer */
export type Unterschrift = {
  stand: string;
  bemerkung: string;
  unterzeichner: string;
  striche: Striche;
};

/** A report in the list: what it is about and who signed, without its content */
export type NachweisKopf = Omit<Zeile, "betriebId" | "inhalt" | "erstelltVon"> & {
  kunde: string;
  auftrag: string;
  summeMinuten: number;
  unterzeichner: string;
};

export type Nachweis = NachweisKopf & { inhalt: Stundennachweis };

const alsKopf = (zeile: Zeile): NachweisKopf => {
  const { betriebId: _b, inhalt: _i, erstelltVon: _e, ...rest } = zeile;
  const inhalt = JSON.parse(zeile.inhalt) as Stundennachweis;
  return {
    ...rest,
    kunde: inhalt.kunde.name,
    auftrag: inhalt.auftrag.name,
    summeMinuten: inhalt.summeMinuten,
    unterzeichner: inhalt.unterschrift.name,
  };
};

const naechsteNummer = (db: Db, betriebId: string): number =>
  (db
    .select({ hoechste: max(stundennachweise.nummer) })
    .from(stundennachweise)
    .where(eq(stundennachweise.betriebId, betriebId))
    .get()?.hoechste ?? 0) + 1;

/** A unique key refused the write: another signature took a booking or the number first */
const vergeben = (fehler: unknown) =>
  fehler instanceof Error && /UNIQUE constraint failed/.test(fehler.message);

/**
 * Signs a Stundennachweis (S-605): the bookings the preview showed, frozen with names, the remark and
 * the customer's name and signature, the time from the server. The report and the lock of each of
 * its bookings go through the audit chain in one transaction; the link of the report hashes its
 * row, and with it `inhalt_hash`, the SHA-256 the PDF prints.
 */
export const nachweisUnterschreiben = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  auswahl: Auswahl,
  unterschrift: Unterschrift,
): Ergebnis<Nachweis> => {
  const vorschau = nachweisVorschau(db, kontext.betriebId, auswahl);
  if (!vorschau.ok) return nein(vorschau.grund);
  const { stand, zeilen, ...kopf } = vorschau.wert;
  if (stand !== unterschrift.stand) return nein("abweichung");
  if (zeilen.length === 0) return nein("leer");
  const nummer = naechsteNummer(db, kontext.betriebId);
  const inhalt: Stundennachweis = {
    ...kopf,
    nummer,
    betrieb: betriebLesen(db, kontext.betriebId)?.name ?? "",
    zeilen: zeilen.map(({ buchungId: _, ...zeile }) => zeile),
    bemerkung: unterschrift.bemerkung,
    unterschrift: {
      name: unterschrift.unterzeichner,
      am: kontext.jetzt,
      striche: unterschrift.striche,
    },
  };
  const text = kanonisch(inhalt);
  const nachweisId = crypto.randomUUID();
  try {
    const zeile = schreiben(schreibDb, kontext, (s) => {
      const neu = s.einfuegen("stundennachweise", {
        betriebId: kontext.betriebId,
        nachweisId,
        nummer,
        projektId: auswahl.projektId,
        nutzerId: auswahl.nutzerId,
        von: auswahl.von,
        bis: auswahl.bis,
        inhalt: text,
        inhaltHash: sha256(text),
        unterschriebenAm: kontext.jetzt,
        erstelltVon: kontext.akteur,
      });
      for (const { buchungId } of zeilen)
        s.einfuegen("stundennachweisBuchungen", {
          betriebId: kontext.betriebId,
          buchungId,
          nachweisId,
        });
      return neu;
    });
    return ok({ ...alsKopf(zeile), inhalt: JSON.parse(zeile.inhalt) as Stundennachweis });
  } catch (fehler) {
    if (vergeben(fehler)) return nein("abweichung");
    throw fehler;
  }
};

/** The reports of the business, newest first; of one person only for someone who keeps no orders */
export const nachweiseLesen = (
  db: Db,
  betriebId: string,
  nutzerId: string | null,
): NachweisKopf[] =>
  db
    .select()
    .from(stundennachweise)
    .where(
      and(
        eq(stundennachweise.betriebId, betriebId),
        nutzerId === null ? undefined : eq(stundennachweise.nutzerId, nutzerId),
      ),
    )
    .orderBy(desc(stundennachweise.nummer))
    .all()
    .map(alsKopf);

const zeileLesen = (db: Db, betriebId: string, nachweisId: string, nutzerId: string | null) => {
  const zeile = db
    .select()
    .from(stundennachweise)
    .where(
      and(eq(stundennachweise.betriebId, betriebId), eq(stundennachweise.nachweisId, nachweisId)),
    )
    .get();
  return zeile && (nutzerId === null || zeile.nutzerId === nutzerId) ? zeile : undefined;
};

/** One report with its content; `nutzerId` limits it to that person's (someone else's is unknown) */
export const nachweisLesen = (
  db: Db,
  betriebId: string,
  nachweisId: string,
  nutzerId: string | null,
): Ergebnis<Nachweis> => {
  const zeile = zeileLesen(db, betriebId, nachweisId, nutzerId);
  if (!zeile) return nein("unbekannt");
  return ok({ ...alsKopf(zeile), inhalt: JSON.parse(zeile.inhalt) as Stundennachweis });
};

/**
 * The PDF of a signed report from its frozen content: the same file each time, for downloading and
 * for S-606, which attaches it to the Leistungen it sends to Haben
 */
export const nachweisPdf = async (
  db: Db,
  betriebId: string,
  nachweisId: string,
  nutzerId: string | null = null,
): Promise<Ergebnis<{ nummer: number; pdf: Uint8Array }>> => {
  const zeile = zeileLesen(db, betriebId, nachweisId, nutzerId);
  if (!zeile) return nein("unbekannt");
  const inhalt = JSON.parse(zeile.inhalt) as Stundennachweis;
  return ok({ nummer: zeile.nummer, pdf: await stundennachweisPdf(inhalt, zeile.inhaltHash) });
};
