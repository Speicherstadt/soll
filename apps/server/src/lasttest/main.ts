import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { nurLesendOeffnen } from "../db/oeffnen.ts";
import { DATENBANK } from "../modules/sicherung/index.ts";
import { auswerten, SCHWELLE } from "./auswertung.ts";
import { alleStempeln, aufbauen } from "./lauf.ts";
import { pruefen } from "./pruefung.ts";

/**
 * `bun run lasttest` (BAULISTE.md S-904): starts the server on a fresh database in an empty
 * temporary directory (never one with real data, CLAUDE.md) on port 28300, sets up 50 businesses
 * with 50 people each through the HTTP API, lets all 2,500 stamp "kommen" at the same moment and
 * checks latency, errors, that every stamp landed once and that every audit chain verifies.
 * Exit code 0 only if all of it holds (threshold: docs/plan.md, "Entscheidungen", "Lasttest").
 */
const { values } = parseArgs({
  options: {
    betriebe: { type: "string", default: "50" },
    personen: { type: "string", default: "50" },
    port: { type: "string", default: "28300" },
  },
});
const betriebe = Number(values.betriebe);
const personen = Number(values.personen);
const url = `http://127.0.0.1:${values.port}`;

// a server already on the port (the user's or another run) would be measured instead: refuse
const belegt = await fetch(`${url}/health`).then(
  () => true,
  () => false,
);
if (belegt) {
  console.error(`port ${values.port} is in use; choose another with --port`);
  process.exit(2);
}

const datenVerzeichnis = mkdtempSync(join(tmpdir(), "soll-lasttest-"));
const server = Bun.spawn(["bun", join(import.meta.dir, "../main.ts")], {
  env: {
    ...process.env,
    SOLL_PORT: values.port,
    SOLL_HOST: "127.0.0.1",
    SOLL_DATA_DIR: datenVerzeichnis,
    SOLL_SECRET_KEY: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64"),
    SOLL_URL: url,
  },
  stdout: "ignore",
  stderr: "inherit",
});

const bereit = async (versuch = 0): Promise<void> => {
  try {
    if ((await fetch(`${url}/health`)).ok) return;
  } catch (fehler) {
    if (versuch >= 100) throw fehler;
  }
  await Bun.sleep(100);
  return bereit(versuch + 1);
};

const ms = (wert: number) => `${wert} ms`;

const lauf = async () => {
  await bereit();
  const angaben = { url, holen: fetch, betriebe, personen, gleichzeitig: 8 };
  const aufbauBeginn = performance.now();
  const aufgebaut = await aufbauen(angaben);
  const aufbauMs = Math.ceil(performance.now() - aufbauBeginn);
  console.log(`set up ${betriebe} businesses with ${personen} people each in ${ms(aufbauMs)}`);

  const beginn = performance.now();
  const messungen = await alleStempeln(aufgebaut.personen);
  const gesamtMs = Math.ceil(performance.now() - beginn);
  const auswertung = auswerten(messungen, betriebe * personen, SCHWELLE);

  const lesend = nurLesendOeffnen(join(datenVerzeichnis, DATENBANK));
  const pruefung = pruefen(lesend.db, aufgebaut.betriebIds, aufgebaut.personen);
  lesend.schliessen();

  console.log(
    [
      `stamps: ${auswertung.anzahl} in ${ms(gesamtMs)} (${Math.floor((auswertung.anzahl * 1000) / gesamtMs)} per second), errors: ${auswertung.fehler} ${JSON.stringify(auswertung.status)}`,
      `latency: p50 ${ms(auswertung.p50Ms)}, p95 ${ms(auswertung.p95Ms)}, p99 ${ms(auswertung.p99Ms)}, max ${ms(auswertung.maxMs)}`,
      `threshold: p95 <= ${ms(SCHWELLE.p95Ms)}, max <= ${ms(SCHWELLE.maxMs)}, no error`,
      `database: ${pruefung.gestempelt} stamps, ${pruefung.nichtGenauEinmal} people not exactly once, ${pruefung.kettenMitBefund} chains with findings, server times within ${ms(pruefung.spanneMs)}`,
    ].join("\n"),
  );
  console.log(JSON.stringify({ betriebe, personen, aufbauMs, gesamtMs, auswertung, pruefung }));
  const bestanden = auswertung.bestanden && pruefung.ok;
  console.log(bestanden ? "PASSED" : `FAILED: ${auswertung.gruende.join("; ") || "database"}`);
  return bestanden;
};

try {
  process.exitCode = (await lauf()) ? 0 : 1;
} finally {
  // only the server this script started; the directory held nothing but the test's database
  server.kill("SIGTERM");
  await server.exited;
  rmSync(datenVerzeichnis, { recursive: true, force: true });
}
