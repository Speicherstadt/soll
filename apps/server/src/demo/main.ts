import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { istTag, tagInBerlin } from "@soll/arbeitszeit";
import { DEMO_PASSWORT } from "./betriebe.ts";
import { demoAnlegen } from "./demo.ts";

/**
 * `bun run demo [--ziel <verzeichnis>] [--heute <JJJJ-MM-TT>]` (BAULISTE.md S-909, docs/demo.md):
 * Weber Haustechnik and Café Elbblick with three months of data in a fresh data directory. Without
 * SOLL_SECRET_KEY it makes a key for this directory and prints it once; it writes it nowhere.
 */
const { values } = parseArgs({
  options: {
    ziel: { type: "string", default: "demo-daten" },
    heute: { type: "string", default: tagInBerlin(Date.now()) },
  },
});
const heute = values.heute;
if (!istTag(heute)) {
  console.error(`--heute must be a day as YYYY-MM-DD, not ${heute}`);
  process.exit(2);
}

const ausUmgebung = process.env.SOLL_SECRET_KEY;
const schluessel = ausUmgebung
  ? new Uint8Array(Buffer.from(ausUmgebung, "base64"))
  : crypto.getRandomValues(new Uint8Array(32));
if (schluessel.length !== 32) {
  console.error("SOLL_SECRET_KEY must be 32 bytes in base64 (openssl rand -base64 32)");
  process.exit(2);
}
const url = (process.env.SOLL_URL ?? "http://localhost:8200").replace(/\/+$/, "");
const ziel = resolve(values.ziel);

const beginn = performance.now();
const ergebnis = await demoAnlegen({ ziel, heute, geheimerSchluessel: schluessel, url });
if (!ergebnis.ok) {
  console.error(`${ziel} already holds a soll.db; the demo only writes into a fresh directory`);
  process.exit(1);
}

const sekunden = Math.ceil((performance.now() - beginn) / 1000);
const zeilen = [
  `demo data in ${ziel}: ${ergebnis.zeitraum.beginn} to ${heute}, ${ergebnis.ereignisse} events in ${sekunden} s`,
  ...ergebnis.betriebe.map(
    (b) =>
      `${b.name}: audit chain ${b.kettenbefunde === 0 ? "verifies" : `has ${b.kettenbefunde} findings`}`,
  ),
  `${ergebnis.pruefwerte.length} months closed, e.g. ${ergebnis.pruefwerte[0]?.pruefwert ?? "-"}`,
  "",
  `DEMO ONLY - sign in with these, the password of all: ${DEMO_PASSWORT}`,
  ...ergebnis.anmeldungen.map(
    (a) => `  ${a.betrieb.padEnd(18)} ${a.name.padEnd(16)} ${a.rolle.padEnd(12)} ${a.anmeldung}`,
  ),
  "",
  `start: SOLL_DATA_DIR=${ziel} SOLL_SECRET_KEY=${ausUmgebung ? "<the same key>" : Buffer.from(schluessel).toString("base64")} SOLL_URL=${url} bun run dev:server`,
  ...(ausUmgebung
    ? []
    : ["The key is printed here only; without it the encrypted columns cannot be read."]),
];
console.log(zeilen.join("\n"));
process.exit(ergebnis.betriebe.every((b) => b.kettenbefunde === 0) ? 0 : 1);
