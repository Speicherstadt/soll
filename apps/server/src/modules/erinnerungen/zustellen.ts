import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import type { Kontext } from "../audit/index.ts";
import { type Mailer, zustellbar } from "../mail/index.ts";
import { adresseVon } from "../mitglieder/index.ts";
import { abosVon, aboVerfallen, type GespeichertesAbo } from "./abos.ts";
import { wuenscheVon } from "./einstellungen.ts";
import { type Sprache, spracheVon } from "./texte.ts";
import { type PushAnfrage, pushAnfrage, type VapidPaar } from "./webpush.ts";

/*
 * Delivering a message to a person: Web Push to each of their devices, and mail when no device
 * took it (S-307). The reminders use it, and so does the plan for what it publishes (S-503).
 */

/** Sends one message to a push service; the stand-in in tests, fetch in production */
export type PushSenden = (anfrage: PushAnfrage) => Promise<{ status: number }>;

/** What the server needs to send Web Push: its VAPID pair, the contact and the way out */
export type Push = { vapid: VapidPaar; kontakt: string; senden: PushSenden };

export type Kanal = "push" | "mail" | "keiner";

/** A message in the language of each device; the mail is German (docs/plan.md, "Sprachen") */
export type Nachricht = {
  text: (sprache: Sprache) => { titel: string; text: string };
  /** where a tap or the link in the mail leads, a path of the app */
  ziel: string;
  /** replaces an earlier notification with the same tag on the device */
  tag: string;
};

/** A message a push service accepted (RFC 8030, Section 5: 201 Created) */
const angenommen = (status: number) => status >= 200 && status < 300;

/** Push to every device given; true when one accepted. A device that is gone is removed. */
export const anGeraete = async (
  deps: { schreibDb: SchreibDb; push: Push },
  kontext: Kontext,
  abos: readonly GespeichertesAbo[],
  nachricht: Nachricht,
): Promise<boolean> => {
  const ergebnisse = await Promise.all(
    abos.map(async ({ aboId, abo, sprache }) => {
      const inhalt = JSON.stringify({
        ...nachricht.text(spracheVon(sprache)),
        ziel: nachricht.ziel,
        tag: nachricht.tag,
      });
      const { status } = await deps.push.senden(
        pushAnfrage({
          abo,
          inhalt,
          vapid: deps.push.vapid,
          kontakt: deps.push.kontakt,
          jetzt: kontext.jetzt,
        }),
      );
      if (status === 404 || status === 410) aboVerfallen(deps.schreibDb, kontext, aboId);
      return angenommen(status);
    }),
  );
  return ergebnisse.includes(true);
};

/** The German mail of a message with the link into the app; false without mail or address */
export const perMail = async (
  mail: Mailer | null,
  url: string,
  adresse: string | null,
  nachricht: Nachricht,
): Promise<boolean> => {
  if (!mail || adresse === null) return false;
  const { titel, text } = nachricht.text("de");
  const ergebnis = await mail({
    an: adresse,
    betreff: titel,
    text: `${text}\n\n${url}${nachricht.ziel}\n`,
  });
  return ergebnis.ok;
};

export type ZustellDeps = {
  db: Db;
  schreibDb: SchreibDb;
  geheimerSchluessel: Uint8Array;
  /** where the instance is reached, for the link in a mail */
  url: string;
  /** null while the server sends no Web Push (an instance in a test without the stand-in) */
  push: Push | null;
  mail: Mailer | null;
};

/**
 * Delivers a message to a person of the business: push to their devices, else mail if they did not
 * turn mail off in their wishes and their address receives it
 */
export const benachrichtigen = async (
  deps: ZustellDeps,
  kontext: Kontext,
  nutzerId: string,
  nachricht: Nachricht,
): Promise<Kanal> => {
  const abos = abosVon(deps.db, deps.geheimerSchluessel, kontext.betriebId, nutzerId);
  if (deps.push && (await anGeraete({ ...deps, push: deps.push }, kontext, abos, nachricht)))
    return "push";
  const roh = wuenscheVon(deps.db, kontext.betriebId, nutzerId).mail
    ? adresseVon(deps.db, nutzerId)
    : null;
  return (await perMail(deps.mail, deps.url, zustellbar(roh) ? roh : null, nachricht))
    ? "mail"
    : "keiner";
};
