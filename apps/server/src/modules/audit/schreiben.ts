import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq, inArray, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { auditGlieder, auditInhalte, auditKoepfe } from "../../db/schema.ts";
import { GENESIS, gliedHash, kanonisch, sha256 } from "./hash.ts";
import { type KettenTabelle, kettenTabellen, type TabellenName, zeilenId } from "./tabellen.ts";

/** Who writes, for which business, and when */
export type Kontext = { betriebId: string; akteur: string; jetzt: number };

type Zeile<N extends TabellenName> = InferSelectModel<KettenTabelle<N>>;
type Neu<N extends TabellenName> = InferInsertModel<KettenTabelle<N>>;
type Schluessel<N extends TabellenName> = Partial<Zeile<N>>;

/** The only way to write Soll's tables: each call appends a link in the same transaction */
export type Schreiber = {
  einfuegen: <N extends TabellenName>(name: N, werte: Neu<N>) => Zeile<N>;
  aendern: <N extends TabellenName>(
    name: N,
    schluessel: Schluessel<N>,
    werte: Partial<Neu<N>>,
  ) => Zeile<N>;
  loeschen: <N extends TabellenName>(name: N, schluessel: Schluessel<N>) => Zeile<N>;
  /**
   * Deletes a row after its retention period (S-901) and the stored contents of every link that
   * wrote it; the links stay, as they hold only the contents' hashes, and the removal is a link of
   * its own. `inhalte` counts the contents removed.
   */
  aussondern: <N extends TabellenName>(
    name: N,
    schluessel: Schluessel<N>,
  ) => { zeile: Zeile<N>; inhalte: number };
};

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const spalte = (name: TabellenName, feld: string): SQLiteColumn =>
  (kettenTabellen[name].tabelle as unknown as Record<string, SQLiteColumn>)[feld] as SQLiteColumn;

/** The row named by its key, always within the writer's business */
const wo = (name: TabellenName, betriebId: string, schluessel: Record<string, unknown>): SQL => {
  const fehlt = kettenTabellen[name].schluessel.filter((feld) => schluessel[feld] === undefined);
  if (fehlt.length > 0) throw new Error(`${name}: key ${fehlt.join(", ")} missing`);
  const bedingungen = kettenTabellen[name].schluessel.map((feld) =>
    eq(spalte(name, feld), schluessel[feld]),
  );
  return and(eq(spalte(name, "betriebId"), betriebId), ...bedingungen) as SQL;
};

const anhaengen = (
  tx: Tx,
  kontext: Kontext,
  glied: {
    tabelle: TabellenName;
    zeile: string;
    aktion: "einfuegen" | "aendern" | "loeschen";
    inhalt: unknown;
  },
): void => {
  // The predecessor is the head, not the last remaining link: a link cut off at the end shows only
  // against the head, and a write that moved the head on from the links would hide the cut
  const letztes = tx
    .select({ seq: auditKoepfe.seq, hash: auditKoepfe.hash })
    .from(auditKoepfe)
    .where(eq(auditKoepfe.betriebId, kontext.betriebId))
    .get();
  const inhalt = kanonisch(glied.inhalt);
  const kern = {
    betriebId: kontext.betriebId,
    seq: (letztes?.seq ?? 0) + 1,
    zeitpunkt: kontext.jetzt,
    akteur: kontext.akteur,
    tabelle: glied.tabelle,
    zeile: glied.zeile,
    aktion: glied.aktion,
    inhaltHash: sha256(inhalt),
  };
  const vorgaengerHash = letztes?.hash ?? GENESIS;
  const hash = gliedHash(vorgaengerHash, kern);
  tx.insert(auditGlieder)
    .values({ ...kern, vorgaengerHash, hash })
    .run();
  tx.insert(auditInhalte).values({ betriebId: kern.betriebId, seq: kern.seq, inhalt }).run();
  tx.insert(auditKoepfe)
    .values({ betriebId: kern.betriebId, seq: kern.seq, hash })
    .onConflictDoUpdate({ target: auditKoepfe.betriebId, set: { seq: kern.seq, hash } })
    .run();
};

const eineZeile = <T>(zeilen: T[], name: string): T => {
  if (zeilen.length !== 1) throw new Error(`${name}: expected one row, found ${zeilen.length}`);
  return zeilen[0] as T;
};

const zeileLoeschen = (
  tx: Tx,
  kontext: Kontext,
  name: TabellenName,
  schluessel: Record<string, unknown>,
): Record<string, unknown> =>
  eineZeile(
    tx
      .delete(kettenTabellen[name].tabelle)
      .where(wo(name, kontext.betriebId, schluessel))
      .returning()
      .all() as Record<string, unknown>[],
    name,
  );

/** Removes the stored contents of a row's links; the check allows a missing content (pruefen.ts) */
const inhalteEntfernen = (tx: Tx, betriebId: string, tabelle: TabellenName, zeile: string) => {
  const glieder = tx
    .select({ seq: auditGlieder.seq })
    .from(auditGlieder)
    .where(
      and(
        eq(auditGlieder.betriebId, betriebId),
        eq(auditGlieder.tabelle, tabelle),
        eq(auditGlieder.zeile, zeile),
      ),
    );
  return tx
    .delete(auditInhalte)
    .where(and(eq(auditInhalte.betriebId, betriebId), inArray(auditInhalte.seq, glieder)))
    .returning({ seq: auditInhalte.seq })
    .all().length;
};

const schreiberFuer = (tx: Tx, kontext: Kontext): Schreiber => ({
  einfuegen: (name, werte) => {
    if ((werte as { betriebId?: string }).betriebId !== kontext.betriebId) {
      throw new Error(`${name}: row of another business`);
    }
    const zeile = eineZeile(
      tx
        .insert(kettenTabellen[name].tabelle)
        .values(werte as never)
        .returning()
        .all(),
      name,
    );
    anhaengen(tx, kontext, {
      tabelle: name,
      zeile: zeilenId(name, zeile),
      aktion: "einfuegen",
      inhalt: zeile,
    });
    return zeile as never;
  },
  aendern: (name, schluessel, werte) => {
    const neu = { ...werte } as Record<string, unknown>;
    for (const feld of ["betriebId", ...kettenTabellen[name].schluessel]) delete neu[feld];
    const zeile = eineZeile(
      tx
        .update(kettenTabellen[name].tabelle)
        .set(neu)
        .where(wo(name, kontext.betriebId, schluessel))
        .returning()
        .all(),
      name,
    );
    anhaengen(tx, kontext, {
      tabelle: name,
      zeile: zeilenId(name, zeile),
      aktion: "aendern",
      inhalt: zeile,
    });
    return zeile as never;
  },
  loeschen: (name, schluessel) => {
    const zeile = zeileLoeschen(tx, kontext, name, schluessel);
    anhaengen(tx, kontext, {
      tabelle: name,
      zeile: zeilenId(name, zeile),
      aktion: "loeschen",
      inhalt: null,
    });
    return zeile as never;
  },
  aussondern: (name, schluessel) => {
    const zeile = zeileLoeschen(tx, kontext, name, schluessel);
    const id = zeilenId(name, zeile);
    const inhalte = inhalteEntfernen(tx, kontext.betriebId, name, id);
    anhaengen(tx, kontext, { tabelle: name, zeile: id, aktion: "loeschen", inhalt: null });
    return { zeile: zeile as never, inhalte };
  },
});

/**
 * Each write in its own savepoint: a write whose link cannot be appended leaves no row behind, even
 * when `arbeit` catches the error and the transaction commits
 */
const einzeln = (tx: Tx, kontext: Kontext): Schreiber => ({
  einfuegen: (name, werte) =>
    tx.transaction((sp) => schreiberFuer(sp, kontext).einfuegen(name, werte)),
  aendern: (name, schluessel, werte) =>
    tx.transaction((sp) => schreiberFuer(sp, kontext).aendern(name, schluessel, werte)),
  loeschen: (name, schluessel) =>
    tx.transaction((sp) => schreiberFuer(sp, kontext).loeschen(name, schluessel)),
  aussondern: (name, schluessel) =>
    tx.transaction((sp) => schreiberFuer(sp, kontext).aussondern(name, schluessel)),
});

const istVersprechen = (wert: unknown): wert is PromiseLike<unknown> =>
  typeof (wert as { then?: unknown } | null)?.then === "function";

/** A writer that refuses every call once its transaction has ended */
const nurWaehrend = (schreiber: Schreiber, offen: () => boolean): Schreiber => {
  const pruefen = () => {
    if (!offen()) throw new Error("schreiben: the transaction has ended");
  };
  return {
    einfuegen: (name, werte) => {
      pruefen();
      return schreiber.einfuegen(name, werte);
    },
    aendern: (name, schluessel, werte) => {
      pruefen();
      return schreiber.aendern(name, schluessel, werte);
    },
    loeschen: (name, schluessel) => {
      pruefen();
      return schreiber.loeschen(name, schluessel);
    },
    aussondern: (name, schluessel) => {
      pruefen();
      return schreiber.aussondern(name, schluessel);
    },
  };
};

/**
 * Runs `arbeit` in one transaction (BEGIN IMMEDIATE, so two writers never take the same number) and
 * hands it the writer; whatever throws rolls back the rows and their links together. `arbeit` must be
 * synchronous: bun:sqlite commits when it returns, so writes after an `await` would land outside the
 * transaction and an error there would no longer roll them back. Asynchronous work is rolled back,
 * and the writer refuses every call after the transaction.
 */
export const schreiben = <T>(
  ziel: SchreibDb,
  kontext: Kontext,
  arbeit: (schreiber: Schreiber) => T,
): T => {
  // SQLite stores UTF-8: a lone surrogate would come back as U+FFFD and the link fail its own check
  if (!kontext.betriebId.isWellFormed() || !kontext.akteur.isWellFormed()) {
    throw new Error("schreiben: betriebId and akteur must be well-formed text");
  }
  let offen = true;
  try {
    return ziel.verbindung.transaction(
      (tx) => {
        const ergebnis = arbeit(nurWaehrend(einzeln(tx, kontext), () => offen));
        if (istVersprechen(ergebnis)) {
          ergebnis.then(undefined, () => undefined);
          throw new Error("schreiben: arbeit must be synchronous");
        }
        return ergebnis;
      },
      { behavior: "immediate" },
    );
  } finally {
    offen = false;
  }
};
