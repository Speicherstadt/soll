import { join } from "node:path";
import { parseBetriebsEnv } from "./env.ts";
import { DATENBANK, sichern, standardZiel, wiederherstellen } from "./modules/sicherung/index.ts";

/** What the binary was asked to do: `soll` starts the server, the rest are commands of the operator */
export type Befehl =
  | { art: "server" }
  | { art: "backup"; ziel: string | null }
  | { art: "restore"; quelle: string }
  | { art: "health" }
  | { art: "unbekannt" };

export const NUTZUNG = [
  "soll                 start the server",
  "soll backup [ziel]   consistent copy of the database (default: $SOLL_DATA_DIR/backups/)",
  "soll restore <quelle> put a backup into an empty $SOLL_DATA_DIR and check the audit chain",
  "soll health          ask /health of the running server (exit 0 when it answers ok)",
].join("\n");

export const befehlLesen = (args: readonly string[]): Befehl => {
  const [name, ...rest] = args;
  if (name === undefined) return { art: "server" };
  if (name === "backup" && rest.length <= 1) return { art: "backup", ziel: rest[0] ?? null };
  if (name === "restore" && rest.length === 1 && rest[0])
    return { art: "restore", quelle: rest[0] };
  if (name === "health" && rest.length === 0) return { art: "health" };
  return { art: "unbekannt" };
};

export type CliDeps = {
  env: Record<string, string | undefined>;
  jetzt: () => number;
  /** fetch, replaced in tests */
  holen: (url: string) => Promise<Response>;
  /** One JSON line per result, as the server logs */
  ausgabe: (zeile: string) => void;
  fehler: (zeile: string) => void;
};

const backup = (ziel: string | null, deps: CliDeps): number => {
  const { dataDir } = parseBetriebsEnv(deps.env);
  const ergebnis = sichern(join(dataDir, DATENBANK), ziel ?? standardZiel(dataDir, deps.jetzt()));
  if (!ergebnis.ok) {
    deps.fehler(JSON.stringify({ msg: "backup failed", grund: ergebnis.grund }));
    return 1;
  }
  deps.ausgabe(
    JSON.stringify({ msg: "backup written", ziel: ergebnis.ziel, bytes: ergebnis.bytes }),
  );
  return 0;
};

/** A restored database whose chain has findings exits with 1: the operator has to look at it */
const restore = (quelle: string, deps: CliDeps): number => {
  const { dataDir } = parseBetriebsEnv(deps.env);
  const ergebnis = wiederherstellen(quelle, dataDir, deps.jetzt());
  if (!ergebnis.ok) {
    deps.fehler(JSON.stringify({ msg: "restore failed", grund: ergebnis.grund }));
    return 1;
  }
  deps.ausgabe(
    JSON.stringify({ msg: "restored", ziel: ergebnis.ziel, betriebe: ergebnis.betriebe }),
  );
  const mitBefund = ergebnis.betriebe.filter((b) => b.befunde > 0).map((b) => b.betriebId);
  if (mitBefund.length === 0) return 0;
  deps.fehler(JSON.stringify({ msg: "audit chain has findings", betriebe: mitBefund }));
  return 1;
};

/** For the container's health check: the image carries no curl, the binary asks itself */
const health = async (deps: CliDeps): Promise<number> => {
  const { port } = parseBetriebsEnv(deps.env);
  try {
    const antwort = await deps.holen(`http://127.0.0.1:${port}/health`);
    const inhalt = (await antwort.json()) as { status?: unknown };
    return antwort.ok && inhalt.status === "ok" ? 0 : 1;
  } catch {
    return 1;
  }
};

/** Runs a command of the operator and returns the exit code; the server itself starts in main.ts */
export const befehlAusfuehren = async (befehl: Befehl, deps: CliDeps): Promise<number> => {
  switch (befehl.art) {
    case "backup":
      return backup(befehl.ziel, deps);
    case "restore":
      return restore(befehl.quelle, deps);
    case "health":
      return health(deps);
    case "server":
    case "unbekannt":
      deps.fehler(NUTZUNG);
      return 2;
  }
};
