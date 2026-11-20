import { asc, eq } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { Db } from "../../db/oeffnen.ts";
import { auditGlieder, auditInhalte, auditKoepfe } from "../../db/schema.ts";
import { GENESIS, gliedHash, kanonisch, sha256 } from "./hash.ts";
import { formatPruefwert, parsePruefwert } from "./pruefwert.ts";
import { kettenTabellen, type TabellenName, zeilenId } from "./tabellen.ts";

/** What the check found; an empty list means the chain and the rows agree */
export type Befund =
  | { art: "glied"; seq: number; grund: "luecke" | "vorgaenger" | "hash" }
  | { art: "inhalt"; seq: number; grund: "hash" | "ohne_glied" }
  | { art: "kopf"; grund: "fehlt" | "abweichend" }
  | { art: "zeile"; tabelle: string; zeile: string; grund: "ohne_glied" | "geaendert" | "fehlt" };

type Glied = typeof auditGlieder.$inferSelect;

/**
 * A hash of what the database holds now, or null when it cannot be hashed: whoever changes the
 * database past the chain can store a fraction, and the check reports that instead of failing
 */
const hashOderNull = (berechnen: () => string): string | null => {
  try {
    return berechnen();
  } catch {
    return null;
  }
};

const gliederPruefen = (glieder: readonly Glied[]): Befund[] =>
  glieder.flatMap((glied, index): Befund[] => {
    const vorgaenger = glieder[index - 1];
    const befunde: Befund[] = [];
    if (glied.seq !== index + 1) befunde.push({ art: "glied", seq: glied.seq, grund: "luecke" });
    if (glied.vorgaengerHash !== (vorgaenger?.hash ?? GENESIS)) {
      befunde.push({ art: "glied", seq: glied.seq, grund: "vorgaenger" });
    }
    if (hashOderNull(() => gliedHash(glied.vorgaengerHash, glied)) !== glied.hash) {
      befunde.push({ art: "glied", seq: glied.seq, grund: "hash" });
    }
    return befunde;
  });

/** A removed content is allowed (retention, S-901); a changed one is not */
const inhaltePruefen = (db: Db, betriebId: string, glieder: readonly Glied[]): Befund[] => {
  const nachSeq = new Map(glieder.map((glied) => [glied.seq, glied]));
  return db
    .select()
    .from(auditInhalte)
    .where(eq(auditInhalte.betriebId, betriebId))
    .all()
    .flatMap((inhalt): Befund[] => {
      const glied = nachSeq.get(inhalt.seq);
      if (!glied) return [{ art: "inhalt", seq: inhalt.seq, grund: "ohne_glied" }];
      return sha256(inhalt.inhalt) === glied.inhaltHash
        ? []
        : [{ art: "inhalt", seq: inhalt.seq, grund: "hash" }];
    });
};

const kopfPruefen = (db: Db, betriebId: string, glieder: readonly Glied[]): Befund[] => {
  const kopf = db.select().from(auditKoepfe).where(eq(auditKoepfe.betriebId, betriebId)).get();
  const letztes = glieder.at(-1);
  if (!letztes) return kopf ? [{ art: "kopf", grund: "abweichend" }] : [];
  if (!kopf) return [{ art: "kopf", grund: "fehlt" }];
  return kopf.seq === letztes.seq && kopf.hash === letztes.hash
    ? []
    : [{ art: "kopf", grund: "abweichend" }];
};

/** Every row must match the content hash of its last link; a row deleted past the chain shows too */
const zeilenPruefen = (db: Db, betriebId: string, glieder: readonly Glied[]): Befund[] =>
  (Object.keys(kettenTabellen) as TabellenName[]).flatMap((name) => {
    const letzte = new Map(
      glieder.filter((glied) => glied.tabelle === name).map((glied) => [glied.zeile, glied]),
    );
    const { tabelle } = kettenTabellen[name];
    const betriebSpalte = (tabelle as unknown as Record<string, SQLiteColumn>)
      .betriebId as SQLiteColumn;
    const zeilen = db.select().from(tabelle).where(eq(betriebSpalte, betriebId)).all() as Record<
      string,
      unknown
    >[];
    const gesehen = new Set<string>();
    const befunde = zeilen.flatMap((zeile): Befund[] => {
      const id = zeilenId(name, zeile);
      gesehen.add(id);
      const glied = letzte.get(id);
      if (!glied || glied.aktion === "loeschen")
        return [{ art: "zeile", tabelle: name, zeile: id, grund: "ohne_glied" }];
      return hashOderNull(() => sha256(kanonisch(zeile))) === glied.inhaltHash
        ? []
        : [{ art: "zeile", tabelle: name, zeile: id, grund: "geaendert" }];
    });
    const fehlend = [...letzte.values()]
      .filter((glied) => glied.aktion !== "loeschen" && !gesehen.has(glied.zeile))
      .map(
        (glied): Befund => ({ art: "zeile", tabelle: name, zeile: glied.zeile, grund: "fehlt" }),
      );
    return [...befunde, ...fehlend];
  });

const gliederVon = (db: Db, betriebId: string): Glied[] =>
  db
    .select()
    .from(auditGlieder)
    .where(eq(auditGlieder.betriebId, betriebId))
    .orderBy(asc(auditGlieder.seq))
    .all();

/** Checks a business's chain: links, contents, head and the rows of every chained table */
export const kettePruefen = (db: Db, betriebId: string): Befund[] => {
  const glieder = gliederVon(db, betriebId);
  return [
    ...gliederPruefen(glieder),
    ...inhaltePruefen(db, betriebId, glieder),
    ...kopfPruefen(db, betriebId, glieder),
    ...zeilenPruefen(db, betriebId, glieder),
  ];
};

/** The current Prüfwert of a business, or null for an empty chain */
export const aktuellerPruefwert = (db: Db, betriebId: string): string | null => {
  const kopf = db.select().from(auditKoepfe).where(eq(auditKoepfe.betriebId, betriebId)).get();
  return kopf ? formatPruefwert(kopf) : null;
};

export type PruefwertErgebnis = "gueltig" | "unlesbar" | "unbekannt" | "abweichend";

/**
 * Compares a Prüfwert a person holds with the database: the link with its number must still carry the
 * same hash, and the chain up to it must be intact (S-306 builds the page on this).
 */
export const pruefwertPruefen = (db: Db, betriebId: string, text: string): PruefwertErgebnis => {
  const wert = parsePruefwert(text);
  if (!wert) return "unlesbar";
  const glieder = gliederVon(db, betriebId).filter((glied) => glied.seq <= wert.seq);
  const glied = glieder.find((g) => g.seq === wert.seq);
  if (!glied) {
    // Soll issued the Prüfwert from the chain, so the chain once reached its number: a missing link,
    // also one cut off together with the head, is a change. Number 0 was never a link.
    return wert.seq >= 1 ? "abweichend" : "unbekannt";
  }
  return glied.hash === wert.hash && gliederPruefen(glieder).length === 0
    ? "gueltig"
    : "abweichend";
};
