import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Monat, plusMonate, type Tag } from "@soll/arbeitszeit";
import { Hono } from "hono";
import { BETRIEBE, DEMO_PASSWORT } from "../demo/betriebe.ts";
import { type Anmeldung, demoAnlegen, demoApp } from "../demo/demo.ts";
import { ENDE_MINUTE, um } from "../demo/zeitraum.ts";
import { webAuslieferung } from "../web.ts";

/**
 * The instance the screenshots are taken of (BAULISTE.md S-908, docs/entwicklung.md): the demo data
 * (S-909) in a fresh temporary directory, then the app on that database with its clock standing
 * still at `--heute` 10:45 in Europe/Berlin and the static build of the web app beside the API, on
 * a free port. Never a directory with real data: the demo refuses one with a `soll.db` (CLAUDE.md).
 */
export type BilderAngaben = { heute: Tag; webVerzeichnis: string };

export type BilderStand = {
  url: string;
  /** the instant the server's clock and the browser's clock stand on */
  jetzt: number;
  passwort: string;
  anmeldungen: Anmeldung[];
  betriebe: { schluessel: string; name: string; betriebId: string }[];
  /** Sandra's Prüfwert of the month before `heute`'s, for the Prüfseite */
  pruefwert: { betriebId: string; pruefwert: string } | null;
};

/** A quarter of an hour after the demo's story ends: the early shift is at work */
export const bilderZeit = (heute: Tag): number => um(heute, 0, ENDE_MINUTE + 15);

const vormonat = (heute: Tag): Monat => plusMonate(heute.slice(0, 7) as Monat, -1);

const betriebeVon = (ergebnis: { betriebe: { name: string; betriebId: string }[] }) =>
  BETRIEBE.map((b) => ({
    schluessel: b.schluessel,
    name: b.name,
    betriebId: ergebnis.betriebe.find((e) => e.name === b.name)?.betriebId ?? "",
  }));

/** Writes the demo data, then serves API and web build on the fixed clock; `schliessen` cleans up */
export const bilderServerStarten = async (angaben: BilderAngaben) => {
  if (!existsSync(join(angaben.webVerzeichnis, "index.html")))
    throw new Error(`no web build in ${angaben.webVerzeichnis}: run bun run build first`);
  const ziel = mkdtempSync(join(tmpdir(), "soll-screenshots-"));
  const geheimerSchluessel = crypto.getRandomValues(new Uint8Array(32));
  let weiter: (anfrage: Request) => Response | Promise<Response> = () =>
    new Response("starting", { status: 503 });
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: (a) => weiter(a) });
  const url = `http://127.0.0.1:${server.port}`;
  const aufraeumen = () => {
    server.stop(true);
    rmSync(ziel, { recursive: true, force: true });
  };
  try {
    const ergebnis = await demoAnlegen({ ziel, heute: angaben.heute, geheimerSchluessel, url });
    if (!ergebnis.ok) throw new Error(`${ziel} already holds a soll.db`);
    const jetzt = bilderZeit(angaben.heute);
    const offen = demoApp(ziel, { geheimerSchluessel, url }, () => jetzt);
    const web = new Hono().get("*", webAuslieferung(angaben.webVerzeichnis));
    weiter = (anfrage) => {
      const pfad = new URL(anfrage.url).pathname;
      return pfad.startsWith("/api/") ? offen.app.fetch(anfrage) : web.fetch(anfrage);
    };
    const betriebe = betriebeVon(ergebnis);
    const monat = vormonat(angaben.heute);
    const wert = ergebnis.pruefwerte.find(
      (p) => p.betrieb === "weber" && p.person === "sandra" && p.monat === monat,
    );
    const stand: BilderStand = {
      url,
      jetzt,
      passwort: DEMO_PASSWORT,
      anmeldungen: ergebnis.anmeldungen,
      betriebe,
      pruefwert: wert
        ? {
            betriebId: betriebe.find((b) => b.schluessel === "weber")?.betriebId ?? "",
            pruefwert: wert.pruefwert,
          }
        : null,
    };
    return {
      stand,
      schliessen: () => {
        offen.schliessen();
        aufraeumen();
      },
    };
  } catch (fehler) {
    aufraeumen();
    throw fehler;
  }
};
