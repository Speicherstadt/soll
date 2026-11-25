import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { befehlAusfuehren, befehlLesen } from "./cli.ts";
import { oeffneDatenbank } from "./db/oeffnen.ts";
import { schreiben } from "./modules/audit/index.ts";
import { temporaerOrdner } from "./test-ordner.ts";

const ordner = () => temporaerOrdner("soll-cli-");

const JETZT = Date.UTC(2026, 10, 20, 3, 15, 7);

/** Runs a command with its output collected; the key is never needed for backup, restore, health */
const laufen = async (
  args: string[],
  env: Record<string, string | undefined>,
  holen: (url: string) => Promise<Response> = () => Promise.reject(new Error("kein Netz")),
) => {
  const ausgabe: string[] = [];
  const fehler: string[] = [];
  const code = await befehlAusfuehren(befehlLesen(args), {
    env,
    jetzt: () => JETZT,
    holen,
    ausgabe: (zeile) => ausgabe.push(zeile),
    fehler: (zeile) => fehler.push(zeile),
  });
  return { code, ausgabe, fehler };
};

describe("befehlLesen", () => {
  it("starts the server without arguments", () => {
    expect(befehlLesen([])).toEqual({ art: "server" });
  });

  it("reads backup with and without a target, restore with its source, and health", () => {
    expect(befehlLesen(["backup"])).toEqual({ art: "backup", ziel: null });
    expect(befehlLesen(["backup", "/sicherung/a.db"])).toEqual({
      art: "backup",
      ziel: "/sicherung/a.db",
    });
    expect(befehlLesen(["restore", "/sicherung/a.db"])).toEqual({
      art: "restore",
      quelle: "/sicherung/a.db",
    });
    expect(befehlLesen(["health"])).toEqual({ art: "health" });
  });

  it("refuses restore without a source, extra arguments and unknown commands", () => {
    expect(befehlLesen(["restore"]).art).toBe("unbekannt");
    expect(befehlLesen(["backup", "a.db", "b.db"]).art).toBe("unbekannt");
    expect(befehlLesen(["sichern"]).art).toBe("unbekannt");
  });
});

describe("befehlAusfuehren", () => {
  it("backs up into backups/ of the data directory and restores into an empty one, without the key", async () => {
    const daten = ordner();
    oeffneDatenbank(join(daten, "soll.db"), JETZT).schliessen();

    const backup = await laufen(["backup"], { SOLL_DATA_DIR: daten });
    expect(backup.code).toBe(0);
    const ziel = join(daten, "backups", "soll-2026-11-20T03-15-07Z.db");
    expect(JSON.parse(backup.ausgabe[0] ?? "")).toMatchObject({ msg: "backup written", ziel });

    const neu = join(ordner(), "neu");
    const restore = await laufen(["restore", ziel], { SOLL_DATA_DIR: neu });
    expect(restore.code).toBe(0);
    expect(JSON.parse(restore.ausgabe[0] ?? "")).toMatchObject({
      msg: "restored",
      ziel: join(neu, "soll.db"),
      betriebe: [],
    });
    expect(existsSync(join(neu, "soll.db"))).toBe(true);
  });

  it("fails with the reason when the target exists", async () => {
    const daten = ordner();
    oeffneDatenbank(join(daten, "soll.db"), JETZT).schliessen();
    const ziel = join(ordner(), "a.db");
    expect((await laufen(["backup", ziel], { SOLL_DATA_DIR: daten })).code).toBe(0);
    const zweite = await laufen(["backup", ziel], { SOLL_DATA_DIR: daten });
    expect(zweite.code).toBe(1);
    expect(JSON.parse(zweite.fehler[0] ?? "")).toEqual({
      msg: "backup failed",
      grund: "ziel_vorhanden",
    });
  });

  it("refuses a restore into a data directory that holds a database", async () => {
    const daten = ordner();
    oeffneDatenbank(join(daten, "soll.db"), JETZT).schliessen();
    const ziel = join(ordner(), "a.db");
    await laufen(["backup", ziel], { SOLL_DATA_DIR: daten });
    const restore = await laufen(["restore", ziel], { SOLL_DATA_DIR: daten });
    expect(restore.code).toBe(1);
    expect(JSON.parse(restore.fehler[0] ?? "")).toEqual({
      msg: "restore failed",
      grund: "ziel_vorhanden",
    });
  });

  it("restores a backup whose chain has findings, but exits with 1 and names the business", async () => {
    const daten = ordner();
    const offen = oeffneDatenbank(join(daten, "soll.db"), JETZT);
    schreiben(offen.schreibDb, { betriebId: "weber", akteur: "jonas", jetzt: JETZT }, (s) =>
      s.einfuegen("betriebe", { betriebId: "weber", name: "Weber", angelegtAm: 1 }),
    );
    offen.sqlite.run("UPDATE betriebe SET name = 'Unbemerkt'");
    offen.schliessen();
    const ziel = join(ordner(), "a.db");
    await laufen(["backup", ziel], { SOLL_DATA_DIR: daten });

    const restore = await laufen(["restore", ziel], { SOLL_DATA_DIR: join(ordner(), "neu") });

    expect(restore.code).toBe(1);
    expect(JSON.parse(restore.ausgabe[0] ?? "")).toMatchObject({ msg: "restored" });
    expect(JSON.parse(restore.fehler[0] ?? "")).toMatchObject({
      msg: "audit chain has findings",
      betriebe: ["weber"],
    });
  });

  it("health asks /health on the configured port and fails when it does not answer ok", async () => {
    const gefragt: string[] = [];
    const ok = await laufen(["health"], { SOLL_PORT: "8300" }, async (url: string) => {
      gefragt.push(String(url));
      return Response.json({ status: "ok", version: "1.0.0" });
    });
    expect(ok.code).toBe(0);
    expect(gefragt).toEqual(["http://127.0.0.1:8300/health"]);

    expect((await laufen(["health"], {})).code).toBe(1);
    const fehler = await laufen(
      ["health"],
      {},
      async () => new Response("kaputt", { status: 500 }),
    );
    expect(fehler.code).toBe(1);
  });

  it("names the usage for an unknown command", async () => {
    const lauf = await laufen(["sichern"], {});
    expect(lauf.code).toBe(2);
    expect(lauf.fehler.join("\n")).toContain("soll backup [ziel]");
  });
});
