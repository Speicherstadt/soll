import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Tag } from "@soll/arbeitszeit";
import { createApp } from "../app.ts";
import { createAuth } from "../auth/auth.ts";
import { oeffneDatenbank, ohneSyncFuerNeueDaten } from "../db/oeffnen.ts";
import { kettePruefen } from "../modules/audit/index.ts";
import { vapidLaden } from "../modules/erinnerungen/index.ts";
import { DATENBANK } from "../modules/sicherung/index.ts";
import { dateispeicher } from "../modules/umzug/index.ts";
import { abspielen, type Pruefwert } from "./ablauf.ts";
import { type Aufgebaut, betriebAufbauen } from "./aufbau.ts";
import { BETRIEBE, CAFE, WEBER } from "./betriebe.ts";
import { aufbauZeit, ereignisseBis } from "./plan.ts";
import { type Zeitraum, zeitraumVon } from "./zeitraum.ts";

/**
 * `bun run demo` (BAULISTE.md S-909): Weber Haustechnik and Café Elbblick with three months of data
 * in a fresh data directory. The app runs in this process on the new database with a clock the demo
 * sets to each event, and every write goes through its HTTP routes and so through the audit chain.
 * An existing `soll.db` is refused: the demo never touches a database with real data (CLAUDE.md).
 */
export type DemoAngaben = {
  ziel: string;
  heute: Tag;
  geheimerSchluessel: Uint8Array;
  /** where the instance will be reached (SOLL_URL): links on time sheets and the passkey origin */
  url: string;
};

export type Anmeldung = { betrieb: string; name: string; rolle: string; anmeldung: string };

export type DemoErgebnis =
  | { ok: false; grund: "vorhanden" }
  | {
      ok: true;
      zeitraum: Zeitraum;
      betriebe: { name: string; betriebId: string; kettenbefunde: number }[];
      anmeldungen: Anmeldung[];
      pruefwerte: Pruefwert[];
      ereignisse: number;
    };

const anmeldungenVon = (aufgebaut: Record<string, Aufgebaut>): Anmeldung[] =>
  BETRIEBE.flatMap((betrieb) =>
    betrieb.personen.map((person) => ({
      betrieb: betrieb.name,
      name: person.name,
      rolle: person.rolle,
      anmeldung: aufgebaut[betrieb.schluessel]?.personen.get(person.schluessel)?.anmeldung ?? "",
    })),
  );

const PINS = new Map(CAFE.personen.flatMap((p) => (p.pin ? [[p.schluessel, p.pin] as const] : [])));

/**
 * The app on the database of a data directory, as the server would start it there, with the clock
 * passed in: the demo sets it to each event, the test reads the result at the end of the story
 */
export const demoApp = (
  ziel: string,
  angaben: Omit<DemoAngaben, "ziel" | "heute">,
  jetzt: () => number,
) => {
  const datenbank = oeffneDatenbank(join(ziel, DATENBANK), jetzt());
  const { db, schreibDb } = datenbank;
  const { geheimerSchluessel, url } = angaben;
  const auth = createAuth({ db, schreibDb, geheimerSchluessel, url, jetzt });
  const vapid = vapidLaden(db, schreibDb, geheimerSchluessel, jetzt());
  const app = createApp({
    log: () => undefined,
    now: jetzt,
    version: "demo",
    db,
    schreibDb,
    auth,
    url,
    mail: null,
    geheimerSchluessel,
    vapidOeffentlich: vapid.oeffentlich,
    dateien: dateispeicher(() => join(ziel, "dateien")),
  });
  const holen = async (adresse: string, init: RequestInit) => app.request(adresse, init);
  return { ...datenbank, app, holen };
};

const spielen = async (
  angaben: DemoAngaben,
  offen: ReturnType<typeof demoApp>,
  uhrStellen: (zeit: number) => void,
): Promise<DemoErgebnis> => {
  const { zeitraum, ereignisse } = ereignisseBis(angaben.heute);
  const umgebung = { holen: offen.holen, url: angaben.url, beginn: zeitraum.beginn };
  const weber = await betriebAufbauen(umgebung, WEBER, angaben.heute);
  const cafe = await betriebAufbauen(umgebung, CAFE, angaben.heute);
  const pruefwerte = await abspielen({ weber, cafe }, PINS, ereignisse, uhrStellen);
  const befunde = (betriebId: string) => kettePruefen(offen.db, betriebId).length;
  return {
    ok: true,
    zeitraum,
    betriebe: [
      { name: WEBER.name, betriebId: weber.betriebId, kettenbefunde: befunde(weber.betriebId) },
      { name: CAFE.name, betriebId: cafe.betriebId, kettenbefunde: befunde(cafe.betriebId) },
    ],
    anmeldungen: anmeldungenVon({ weber, cafe }),
    pruefwerte,
    ereignisse: ereignisse.length,
  };
};

export const demoAnlegen = async (angaben: DemoAngaben): Promise<DemoErgebnis> => {
  if (existsSync(join(angaben.ziel, DATENBANK))) return { ok: false, grund: "vorhanden" };
  mkdirSync(angaben.ziel, { recursive: true });
  let uhr = aufbauZeit(zeitraumVon(angaben.heute));
  const offen = demoApp(angaben.ziel, angaben, () => uhr);
  // without a sync after every write the run takes half the time; only for this fresh directory
  ohneSyncFuerNeueDaten(offen);
  try {
    return await spielen(angaben, offen, (zeit) => {
      uhr = zeit;
    });
  } finally {
    offen.schliessen();
  }
};
