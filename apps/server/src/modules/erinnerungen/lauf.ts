import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import type { Kontext } from "../audit/index.ts";
import { betriebeMitModul } from "../betrieb/index.ts";
import type { Mailer } from "../mail/index.ts";
import { aboVerfallen } from "./abos.ts";
import { type Erreichbar, personenDaten } from "./daten.ts";
import { regelnVon } from "./einstellungen.ts";
import { type Art, type Faellig, faelligeErinnerungen } from "./faellig.ts";
import { spracheVon, textVon, zielVon } from "./texte.ts";
import { erinnertIn, vermerken } from "./vermerk.ts";
import { type PushAnfrage, pushAnfrage, type VapidPaar } from "./webpush.ts";

/** Sends one message to a push service; the stand-in in tests, fetch in production */
export type PushSenden = (anfrage: PushAnfrage) => Promise<{ status: number }>;

export type LaufDeps = {
  db: Db;
  schreibDb: SchreibDb;
  geheimerSchluessel: Uint8Array;
  vapid: VapidPaar;
  /** where the instance is reached: the VAPID contact and the link in a mail */
  url: string;
  push: PushSenden;
  mail: Mailer | null;
};

export type Gesendet = {
  betriebId: string;
  nutzerId: string;
  art: Art;
  kanal: "push" | "mail" | "keiner";
};

/** The push service in production: one POST per message (RFC 8030, Section 5) */
export const pushPerFetch: PushSenden = async (anfrage) => {
  try {
    const antwort = await fetch(anfrage.url, {
      method: "POST",
      headers: anfrage.headers,
      body: new Blob([new Uint8Array(anfrage.body)]),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    return { status: antwort.status };
  } catch {
    return { status: 0 };
  }
};

/** A message a push service accepted (RFC 8030, Section 5: 201 Created) */
const angenommen = (status: number) => status >= 200 && status < 300;

/** Push to every device of the person; true when one accepted. A gone device is removed. */
const perPush = async (
  deps: LaufDeps,
  kontext: Kontext,
  p: Erreichbar,
  e: Faellig,
  jetzt: number,
) => {
  const ergebnisse = await Promise.all(
    p.abos.map(async ({ aboId, abo, sprache }) => {
      const inhalt = JSON.stringify({
        ...textVon(e, spracheVon(sprache)),
        ziel: zielVon(e),
        tag: e.art,
      });
      const { status } = await deps.push(
        pushAnfrage({ abo, inhalt, vapid: deps.vapid, kontakt: deps.url, jetzt }),
      );
      if (status === 404 || status === 410) aboVerfallen(deps.schreibDb, kontext, aboId);
      return angenommen(status);
    }),
  );
  return ergebnisse.includes(true);
};

const perMail = async (deps: LaufDeps, p: Erreichbar, e: Faellig): Promise<boolean> => {
  if (!deps.mail || p.adresse === null) return false;
  const { titel, text } = textVon(e, "de");
  const ergebnis = await deps.mail({
    an: p.adresse,
    betreff: titel,
    text: `${text}\n\n${deps.url}${zielVon(e)}\n`,
  });
  return ergebnis.ok;
};

const zustellen = async (
  deps: LaufDeps,
  kontext: Kontext,
  p: Erreichbar,
  e: Faellig,
): Promise<Gesendet["kanal"]> => {
  if (await perPush(deps, kontext, p, e, kontext.jetzt)) return "push";
  if (await perMail(deps, p, e)) return "mail";
  return "keiner";
};

const betriebLauf = async (deps: LaufDeps, betriebId: string, jetzt: number) => {
  const personen = personenDaten(
    deps.db,
    deps.geheimerSchluessel,
    betriebId,
    jetzt,
    deps.mail !== null,
  );
  const faellig = faelligeErinnerungen({
    jetzt,
    regeln: regelnVon(deps.db, betriebId),
    personen,
    erinnert: erinnertIn(deps.db, betriebId, jetzt),
  });
  const kontext: Kontext = { betriebId, akteur: "system", jetzt };
  const gesendet: Gesendet[] = [];
  for (const e of faellig) {
    const p = personen.find((person) => person.nutzerId === e.nutzerId);
    if (!p || !vermerken(deps.schreibDb, kontext, e)) continue;
    gesendet.push({
      betriebId,
      nutzerId: e.nutzerId,
      art: e.art,
      kanal: await zustellen(deps, kontext, p, e),
    });
  }
  return gesendet;
};

/**
 * One run over every business that uses working time: what is due is noted, then sent. It reads
 * stamps and never writes one (CLAUDE.md: never stamp out automatically).
 */
export const erinnerungsLauf = async (deps: LaufDeps, jetzt: number): Promise<Gesendet[]> => {
  const alle: Gesendet[] = [];
  for (const betriebId of betriebeMitModul(deps.db, "arbeitszeit")) {
    alle.push(...(await betriebLauf(deps, betriebId, jetzt)));
  }
  return alle;
};

/**
 * Runs `erinnerungsLauf` every minute; a run still going when the next is due is not doubled.
 * Returns the function that stops it.
 */
export const erinnerungsSchleife = (
  deps: LaufDeps,
  jetzt: () => number,
  log: (zeile: string) => void,
  intervallMs = 60_000,
): (() => void) => {
  let laeuft = false;
  const takt = setInterval(() => {
    if (laeuft) return;
    laeuft = true;
    erinnerungsLauf(deps, jetzt())
      .then((gesendet) => {
        // who and what stay out of the log; only how many went out by which way
        for (const kanal of ["push", "mail", "keiner"] as const) {
          const anzahl = gesendet.filter((g) => g.kanal === kanal).length;
          if (anzahl > 0) log(JSON.stringify({ msg: "erinnerungen", kanal, anzahl }));
        }
      })
      .catch((fehler) =>
        log(JSON.stringify({ msg: "erinnerungen fehlgeschlagen", fehler: String(fehler) })),
      )
      .finally(() => {
        laeuft = false;
      });
  }, intervallMs);
  return () => clearInterval(takt);
};
