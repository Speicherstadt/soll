import { Database } from "bun:sqlite";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { oeffneDatenbank } from "../../db/oeffnen.ts";
import { aktuellerPruefwert, kettePruefen, schreiben } from "../audit/index.ts";
import { sichern, standardZiel, wiederherstellen } from "./index.ts";

const JETZT = 1_790_000_000_000;

const ordner = () => {
  const pfad = mkdtempSync(join(tmpdir(), "soll-sicherung-"));
  afterEach(() => rmSync(pfad, { recursive: true, force: true }));
  return pfad;
};

/** Weber Haustechnik and Café Elbblick, each with links in its chain, in a live data directory */
const laufenderServer = () => {
  const daten = ordner();
  const pfad = join(daten, "soll.db");
  const offen = oeffneDatenbank(pfad, JETZT);
  afterEach(() => offen.schliessen());
  const weber = { betriebId: "weber", akteur: "jonas", jetzt: JETZT };
  const elbblick = { betriebId: "elbblick", akteur: "mia", jetzt: JETZT };
  schreiben(offen.schreibDb, weber, (s) =>
    s.einfuegen("betriebe", { betriebId: "weber", name: "Weber", angelegtAm: 1 }),
  );
  schreiben(offen.schreibDb, weber, (s) =>
    s.aendern("betriebe", { betriebId: "weber" }, { name: "Weber Haustechnik" }),
  );
  schreiben(offen.schreibDb, elbblick, (s) =>
    s.einfuegen("betriebe", { betriebId: "elbblick", name: "Café Elbblick", angelegtAm: 2 }),
  );
  return { ...offen, daten, pfad };
};

const betriebe = (sqlite: Database) =>
  sqlite.query("SELECT betrieb_id, name FROM betriebe ORDER BY betrieb_id").all();

describe("sichern", () => {
  it("copies the live database with VACUUM INTO, also what still lies in the WAL", () => {
    const server = laufenderServer();
    // the writes are committed but not checkpointed: they live in soll.db-wal
    expect(statSync(`${server.pfad}-wal`).size).toBeGreaterThan(0);
    const ziel = join(ordner(), "sicherung.db");

    const ergebnis = sichern(server.pfad, ziel);

    expect(ergebnis).toEqual({ ok: true, ziel, bytes: statSync(ziel).size });
    const kopie = new Database(ziel, { readonly: true });
    expect(betriebe(kopie)).toEqual(betriebe(server.sqlite));
    kopie.close();
    // one file, no WAL beside it: the copy can be moved as it is
    expect(existsSync(`${ziel}-wal`)).toBe(false);
  });

  it("is consistent while a writer holds an open transaction: the copy has only what was committed", () => {
    const server = laufenderServer();
    server.sqlite.run("BEGIN IMMEDIATE");
    server.sqlite.run(
      "INSERT INTO betriebe (betrieb_id, name, angelegt_am) VALUES ('halb', 'Halb geschrieben', 3)",
    );
    const ziel = join(ordner(), "sicherung.db");

    const ergebnis = sichern(server.pfad, ziel);
    server.sqlite.run("COMMIT");

    expect(ergebnis.ok).toBe(true);
    const kopie = new Database(ziel, { readonly: true });
    expect(betriebe(kopie).map((zeile) => (zeile as { betrieb_id: string }).betrieb_id)).toEqual([
      "elbblick",
      "weber",
    ]);
    kopie.close();
  });

  it("creates the target directory", () => {
    const server = laufenderServer();
    const ziel = join(ordner(), "backups", "2026", "soll.db");
    expect(sichern(server.pfad, ziel).ok).toBe(true);
    expect(existsSync(ziel)).toBe(true);
  });

  it("never overwrites an existing file", () => {
    const server = laufenderServer();
    const ziel = join(ordner(), "sicherung.db");
    writeFileSync(ziel, "eine ältere Sicherung");
    expect(sichern(server.pfad, ziel)).toEqual({ ok: false, grund: "ziel_vorhanden" });
    expect(readFileSync(ziel, "utf8")).toBe("eine ältere Sicherung");
  });

  it("refuses a missing database instead of creating an empty one", () => {
    const daten = ordner();
    const ziel = join(ordner(), "sicherung.db");
    expect(sichern(join(daten, "soll.db"), ziel)).toEqual({ ok: false, grund: "quelle_fehlt" });
    expect(existsSync(join(daten, "soll.db"))).toBe(false);
    expect(existsSync(ziel)).toBe(false);
  });
});

describe("standardZiel", () => {
  it("names the file after the instant in UTC, under backups/ of the data directory", () => {
    expect(standardZiel("/data", Date.UTC(2026, 10, 20, 3, 15, 7))).toBe(
      "/data/backups/soll-2026-11-20T03-15-07Z.db",
    );
  });
});

describe("wiederherstellen", () => {
  const gesichert = () => {
    const server = laufenderServer();
    const ziel = join(ordner(), "sicherung.db");
    const ergebnis = sichern(server.pfad, ziel);
    if (!ergebnis.ok) throw new Error(ergebnis.grund);
    return { server, sicherung: ziel };
  };

  it("restores into an empty directory: same rows, same Prüfwerte, the chain checks clean", () => {
    const { server, sicherung } = gesichert();
    const neu = join(ordner(), "daten");

    const ergebnis = wiederherstellen(sicherung, neu, JETZT);

    expect(ergebnis).toEqual({
      ok: true,
      ziel: join(neu, "soll.db"),
      betriebe: [
        { betriebId: "elbblick", befunde: 0 },
        { betriebId: "weber", befunde: 0 },
      ],
    });
    // the server opens the restored database as on any start
    const wieder = oeffneDatenbank(join(neu, "soll.db"), JETZT);
    expect(betriebe(wieder.sqlite)).toEqual(betriebe(server.sqlite));
    for (const betriebId of ["weber", "elbblick"]) {
      expect(kettePruefen(wieder.db, betriebId)).toEqual([]);
      expect(aktuellerPruefwert(wieder.db, betriebId)).toBe(
        aktuellerPruefwert(server.db, betriebId),
      );
    }
    wieder.schliessen();
  });

  it("reports findings of the chain, so a tampered backup is not taken for a clean one", () => {
    const { sicherung } = gesichert();
    const roh = new Database(sicherung);
    roh.run("UPDATE betriebe SET name = 'Unbemerkt' WHERE betrieb_id = 'weber'");
    roh.close();

    const ergebnis = wiederherstellen(sicherung, join(ordner(), "daten"), JETZT);

    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.betriebe.find((b) => b.betriebId === "weber")?.befunde).toBeGreaterThan(0);
    expect(ergebnis.betriebe.find((b) => b.betriebId === "elbblick")?.befunde).toBe(0);
  });

  it("refuses a data directory that already holds a database and leaves it as it was", () => {
    const { server, sicherung } = gesichert();
    expect(wiederherstellen(sicherung, server.daten, JETZT)).toEqual({
      ok: false,
      grund: "ziel_vorhanden",
    });
    expect(betriebe(server.sqlite)).toHaveLength(2);
  });

  it("refuses a directory with a leftover WAL file, which SQLite would replay into the copy", () => {
    const { sicherung } = gesichert();
    const neu = ordner();
    writeFileSync(join(neu, "soll.db-wal"), "");
    expect(wiederherstellen(sicherung, neu, JETZT)).toEqual({
      ok: false,
      grund: "ziel_vorhanden",
    });
  });

  it("refuses a missing file, a file that is no database and a database of another app", () => {
    const fremd = ordner();
    const keineDb = join(fremd, "notiz.db");
    writeFileSync(keineDb, "das ist keine Datenbank, nur Text, der lang genug ist ".repeat(20));
    const andere = join(fremd, "andere.db");
    const sqlite = new Database(andere, { create: true });
    sqlite.run("CREATE TABLE notizen (text TEXT)");
    sqlite.close();

    expect(wiederherstellen(join(fremd, "fehlt.db"), join(ordner(), "a"), JETZT)).toEqual({
      ok: false,
      grund: "quelle_fehlt",
    });
    expect(wiederherstellen(keineDb, join(ordner(), "b"), JETZT)).toEqual({
      ok: false,
      grund: "kaputt",
    });
    expect(wiederherstellen(andere, join(ordner(), "c"), JETZT)).toEqual({
      ok: false,
      grund: "keine_soll_datenbank",
    });
  });

  it("leaves no half-written database behind when it refuses", () => {
    const fremd = ordner();
    const andere = join(fremd, "andere.db");
    const sqlite = new Database(andere, { create: true });
    sqlite.run("CREATE TABLE notizen (text TEXT)");
    sqlite.close();
    const neu = join(ordner(), "daten");
    mkdirSync(neu);
    wiederherstellen(andere, neu, JETZT);
    expect(existsSync(join(neu, "soll.db"))).toBe(false);
  });
});
