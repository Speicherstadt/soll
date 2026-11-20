import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { bestandPruefen, datenbankKopieren, oeffneDatenbank } from "../../db/oeffnen.ts";
import { auditGlieder, betriebe } from "../../db/schema.ts";
import { kettePruefen } from "../audit/index.ts";

/** The database file in a data directory (src/main.ts opens the same) */
export const DATENBANK = "soll.db";

export type Sicherung =
  | { ok: true; ziel: string; bytes: number }
  | { ok: false; grund: "quelle_fehlt" | "ziel_vorhanden" | "kaputt" };

export type Wiederherstellung =
  | { ok: true; ziel: string; betriebe: { betriebId: string; befunde: number }[] }
  | { ok: false; grund: "quelle_fehlt" | "ziel_vorhanden" | "kaputt" | "keine_soll_datenbank" };

/** `backups/soll-2026-11-20T03-15-07Z.db` in the data directory: sorts by time, no colons */
export const standardZiel = (datenVerzeichnis: string, jetzt: number): string =>
  join(
    datenVerzeichnis,
    "backups",
    `soll-${new Date(jetzt).toISOString().slice(0, 19).replaceAll(":", "-")}Z.db`,
  );

/**
 * Writes a consistent copy of the live database to `ziel` (VACUUM INTO, also while the server
 * writes) and checks it; an existing file is never overwritten, a missing database never created
 */
export const sichern = (quelle: string, ziel: string): Sicherung => {
  if (!existsSync(quelle)) return { ok: false, grund: "quelle_fehlt" };
  if (existsSync(ziel)) return { ok: false, grund: "ziel_vorhanden" };
  mkdirSync(dirname(ziel), { recursive: true });
  try {
    datenbankKopieren(quelle, ziel);
  } catch {
    rmSync(ziel, { force: true });
    return { ok: false, grund: "kaputt" };
  }
  if (bestandPruefen(ziel) !== "soll") {
    rmSync(ziel, { force: true });
    return { ok: false, grund: "kaputt" };
  }
  return { ok: true, ziel, bytes: statSync(ziel).size };
};

/** The database and the files SQLite keeps beside it; any of them makes a directory taken */
const belegt = (ziel: string): boolean =>
  [ziel, `${ziel}-wal`, `${ziel}-shm`, `${ziel}-journal`].some((pfad) => existsSync(pfad));

/** Every business with a chain or a row, so a business whose row was removed is still checked */
const kettenPruefen = (ziel: string, jetzt: number) => {
  const offen = oeffneDatenbank(ziel, jetzt);
  try {
    const ids = new Set(
      [
        ...offen.db.selectDistinct({ id: auditGlieder.betriebId }).from(auditGlieder).all(),
        ...offen.db.select({ id: betriebe.betriebId }).from(betriebe).all(),
      ].map((zeile) => zeile.id),
    );
    return [...ids]
      .sort()
      .map((betriebId) => ({ betriebId, befunde: kettePruefen(offen.db, betriebId).length }));
  } finally {
    offen.schliessen();
  }
};

/**
 * Puts a backup into an empty data directory: refuses one that holds a database (the running
 * server's, or a restore half done), a file that is not intact and another app's database; then
 * opens it as the server would (newer migrations applied) and checks every business's chain
 */
export const wiederherstellen = (
  quelle: string,
  datenVerzeichnis: string,
  jetzt: number,
): Wiederherstellung => {
  if (!existsSync(quelle)) return { ok: false, grund: "quelle_fehlt" };
  const ziel = join(datenVerzeichnis, DATENBANK);
  if (belegt(ziel)) return { ok: false, grund: "ziel_vorhanden" };
  const bestand = bestandPruefen(quelle);
  if (bestand === "kaputt") return { ok: false, grund: "kaputt" };
  if (bestand === "fremd") return { ok: false, grund: "keine_soll_datenbank" };
  mkdirSync(datenVerzeichnis, { recursive: true });
  try {
    datenbankKopieren(quelle, ziel);
    return { ok: true, ziel, betriebe: kettenPruefen(ziel, jetzt) };
  } catch {
    for (const pfad of [ziel, `${ziel}-wal`, `${ziel}-shm`]) rmSync(pfad, { force: true });
    return { ok: false, grund: "kaputt" };
  }
};
