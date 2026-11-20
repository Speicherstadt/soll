/** Café Elbblick with a push service and an SMTP server stood in, for the tests of S-307 */
import { erinnerungsLauf, type LaufDeps } from "../modules/erinnerungen/index.ts";
import { pushDienstErsatz, testAbo } from "../modules/erinnerungen/push-test.ts";
import { smtpMailer } from "../modules/mail/index.ts";
import { smtpTestServer } from "../modules/mail/smtp-test.ts";
import { TEST_URL, testServer } from "../test-server.ts";

export const PFAD = "/api/v1/arbeitszeit/erinnerungen";
/** a time in Berlin in winter (+01:00) */
export const um = (tag: string, zeit: string) => Date.parse(`${tag}T${zeit}+01:00`);
export const TAG = "2026-11-18";

/**
 * Mia (owner, with an e-mail address) and Tom (invited without one) at 6:00 on 18.11.2026; the push
 * service and SMTP are stand-ins (CLAUDE.md), `lauf` runs the reminders at an instant
 */
export const cafe = async () => {
  const smtp = await smtpTestServer();
  const server = testServer({ mail: smtpMailer(smtp.url, "Soll <soll@elbblick.test>") });
  server.stelleUhr(um(TAG, "06:00"));
  const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  const tom = await server.eingeladen(mia, "mitarbeiter", "tom");
  const geraete = new Map<string, ReturnType<typeof testAbo>>();
  const antworten = new Map<string, number>();
  const dienst = pushDienstErsatz(() => server.vapid.oeffentlich, geraete, antworten);
  type Wer = typeof tom | typeof mia;
  /** A device of the person subscribes, in the app's language there */
  const abonnieren = async (wer: Wer, name: string, sprache = "de") => {
    const geraet = testAbo(`https://fcm.googleapis.com/fcm/send/${name}`);
    geraete.set(geraet.json.endpoint, geraet);
    const antwort = await wer.anfrage(`${PFAD}/abos`, { body: { ...geraet.json, sprache } });
    return { geraet, antwort };
  };
  const stempeln = async (wer: Wer, art: string, zeitpunkt: number) => {
    server.stelleUhr(zeitpunkt);
    const antwort = await wer.anfrage("/api/v1/arbeitszeit/stempelungen", { body: { art } });
    if (antwort.status !== 201) throw new Error(`stempeln ${antwort.status}`);
  };
  const deps: LaufDeps = {
    db: server.db,
    schreibDb: server.schreibDb,
    geheimerSchluessel: server.geheimerSchluessel,
    vapid: server.vapid,
    url: TEST_URL,
    push: dienst.senden,
    mail: smtpMailer(smtp.url, "Soll <soll@elbblick.test>"),
  };
  const lauf = (jetzt: number) => {
    server.stelleUhr(jetzt);
    return erinnerungsLauf(deps, jetzt);
  };
  return { server, smtp, mia, tom, dienst, antworten, abonnieren, stempeln, lauf, deps };
};
