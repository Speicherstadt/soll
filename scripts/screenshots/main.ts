import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { aufnehmen, type Stand, tabletKoppeln } from "./aufnahme.ts";
import { aufnahmen, BILDSCHIRME, STANDARD_HEUTE, ZIEL } from "./bildschirme.ts";

/**
 * `bun run screenshots [--heute <JJJJ-MM-TT>] [--ziel <verzeichnis>] [--nur <name>]…
 * [--ohne-build]` (BAULISTE.md S-908, docs/entwicklung.md "Screenshots"): builds the web app, starts
 * the screenshot server on fresh demo data (apps/server/src/screenshots/main.ts) and writes every
 * picture of scripts/screenshots/bildschirme.ts.
 */
const { values } = parseArgs({
  options: {
    heute: { type: "string", default: STANDARD_HEUTE },
    ziel: { type: "string", default: ZIEL },
    nur: { type: "string", multiple: true, default: [] },
    "ohne-build": { type: "boolean", default: false },
  },
});

const ausfuehren = (befehl: string[]) => {
  const { exitCode } = Bun.spawnSync(befehl, { stdout: "inherit", stderr: "inherit" });
  if (exitCode !== 0) throw new Error(`${befehl.join(" ")} failed with ${exitCode}`);
};

/** Starts the server and waits for its line `READY <json>` */
const serverStarten = async (heute: string) => {
  const prozess = Bun.spawn(
    ["bun", "apps/server/src/screenshots/main.ts", "--heute", heute, "--web", "apps/web/dist"],
    { stdout: "pipe", stderr: "inherit" },
  );
  const leser = prozess.stdout.pipeThrough(new TextDecoderStream()).getReader();
  let gelesen = "";
  while (!gelesen.includes("\n")) {
    const { value, done } = await leser.read();
    if (done) throw new Error(`the screenshot server stopped: ${gelesen}`);
    gelesen += value;
  }
  const zeile = gelesen.split("\n").find((z) => z.startsWith("READY ")) ?? "";
  if (!zeile) throw new Error(`unexpected output of the screenshot server: ${gelesen}`);
  return { prozess, stand: JSON.parse(zeile.slice("READY ".length)) as Stand };
};

const liste = aufnahmen(BILDSCHIRME, values.nur);
if (liste.length === 0) {
  console.error(`no screen named ${values.nur.join(", ")}`);
  process.exit(2);
}
if (!values["ohne-build"]) ausfuehren(["bun", "run", "--cwd", "apps/web", "build"]);

const { prozess, stand } = await serverStarten(values.heute);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
// German date fields: Chromium formats <input type="date"> in its own language (on Linux from
// LANGUAGE), not in the page's locale
const browser = await chromium.launch({
  args: ["--lang=de-DE"],
  env: { ...process.env, LANG: "de_DE.UTF-8", LANGUAGE: "de" },
  ...(executablePath ? { executablePath } : {}),
});
try {
  const umgebung = {
    browser,
    stand,
    texte: JSON.parse(readFileSync("messages/de.json", "utf8")) as Record<string, string>,
    kopplung: await tabletKoppeln(browser, stand),
    ziel: resolve(values.ziel),
  };
  for (const aufnahme of liste) console.log(await aufnehmen(umgebung, aufnahme));
} finally {
  await browser.close();
  prozess.kill("SIGTERM");
  await prozess.exited;
}
