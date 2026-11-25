import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import type { Kontext } from "../audit/index.ts";
import { betriebeMitModul } from "../betrieb/index.ts";
import type { Mailer } from "../mail/index.ts";
import { type Erreichbar, personenDaten } from "./daten.ts";
import { regelnVon } from "./einstellungen.ts";
import { type Art, type Faellig, faelligeErinnerungen } from "./faellig.ts";
import { textVon, zielVon } from "./texte.ts";
import { erinnertIn, vermerken } from "./vermerk.ts";
import type { VapidPaar } from "./webpush.ts";
import { anGeraete, type Kanal, type Nachricht, type PushSenden, perMail } from "./zustellen.ts";

export type { PushSenden } from "./zustellen.ts";

export type LaufDeps = {
  db: Db;
  schreibDb: SchreibDb;
  geheimerSchluessel: Uint8Array;
  vapid: VapidPaar;
  /** where the instance is reached, for the link in a mail */
  url: string;
  /** the VAPID contact, from `vapidKontakt` */
  kontakt: string;
  push: PushSenden;
  mail: Mailer | null;
};

export type Gesendet = {
  betriebId: string;
  nutzerId: string;
  art: Art;
  kanal: Kanal;
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

/** A reminder as a message: its text in each language and where a tap leads */
const nachrichtVon = (e: Faellig): Nachricht => ({
  text: (sprache) => textVon(e, sprache),
  ziel: zielVon(e),
  tag: e.art,
});

const zustellen = async (
  deps: LaufDeps,
  kontext: Kontext,
  p: Erreichbar,
  e: Faellig,
): Promise<Kanal> => {
  const nachricht = nachrichtVon(e);
  const push = { vapid: deps.vapid, kontakt: deps.kontakt, senden: deps.push };
  if (await anGeraete({ schreibDb: deps.schreibDb, push }, kontext, p.abos, nachricht))
    return "push";
  if (await perMail(deps.mail, deps.url, p.adresse, nachricht)) return "mail";
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
