import { quelleVon } from "@soll/import";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { importe } from "../../db/schema.ts";
import { namenVon } from "../mitglieder/index.ts";
import type { Dateispeicher } from "./dateispeicher.ts";
import { keineZahlen, type Zahlen } from "./plan-typen.ts";

/* The imports a business took over, newest first, and the original file of each (S-701) */

export type ImportEintrag = {
  importId: string;
  quelle: string;
  /** the tool's name, or its id for a tool this version of Soll no longer knows */
  quelleName: string;
  dateiName: string;
  dateiSha256: string;
  dateiBytes: number;
  abgeschlossenBis: string | null;
  zahlen: Zahlen;
  von: string;
  am: number;
};

type Zeile = typeof importe.$inferSelect;

const alsEintrag = (zeile: Zeile, namen: Map<string, string>): ImportEintrag => ({
  importId: zeile.importId,
  quelle: zeile.quelle,
  quelleName: quelleVon(zeile.quelle)?.name ?? zeile.quelle,
  dateiName: zeile.dateiName,
  dateiSha256: zeile.dateiSha256,
  dateiBytes: zeile.dateiBytes,
  abgeschlossenBis: zeile.abgeschlossenBis,
  // an import before S-703 knew no activities: none of them
  zahlen: { ...keineZahlen(), ...(JSON.parse(zeile.zahlen) as Partial<Zahlen>) },
  von: namen.get(zeile.erstelltVon) ?? "",
  am: zeile.erstelltAm,
});

export const importeLesen = (db: Db, betriebId: string): ImportEintrag[] => {
  const zeilen = db
    .select()
    .from(importe)
    .where(eq(importe.betriebId, betriebId))
    .orderBy(desc(importe.erstelltAm))
    .all();
  const namen = namenVon(
    db,
    zeilen.map((z) => z.erstelltVon),
  );
  return zeilen.map((zeile) => alsEintrag(zeile, namen));
};

const importZeile = (db: Db, betriebId: string, importId: string): Zeile | undefined =>
  db
    .select()
    .from(importe)
    .where(and(eq(importe.betriebId, betriebId), eq(importe.importId, importId)))
    .get();

export type DateiErgebnis =
  | { ok: true; name: string; bytes: Uint8Array }
  | { ok: false; grund: "unbekannt" | "fehlt" | "beschaedigt" };

/** The original file of an import of the business, checked against its hash */
export const importDatei = async (
  db: Db,
  speicher: Dateispeicher,
  betriebId: string,
  importId: string,
): Promise<DateiErgebnis> => {
  const zeile = importZeile(db, betriebId, importId);
  if (!zeile) return { ok: false, grund: "unbekannt" };
  const zustand = await speicher.pruefen(zeile.dateiSha256);
  if (zustand !== "ok") return { ok: false, grund: zustand };
  return {
    ok: true,
    name: zeile.dateiName,
    bytes: new Uint8Array(await speicher.laden(zeile.dateiSha256)),
  };
};
