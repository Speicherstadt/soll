import { pushDienstErsatz, testAbo } from "../modules/erinnerungen/push-test.ts";
import { smtpMailer } from "../modules/mail/index.ts";
import { smtpTestServer } from "../modules/mail/smtp-test.ts";
import { testServer } from "../test-server.ts";

export const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

export const SPAET = {
  name: "Spät",
  beginnMinute: 14 * 60,
  endeMinute: 22 * 60,
  pauseMinuten: 30,
  rolle: "Service",
};

/**
 * "Café Elbblick" with the module Dienstplan, its site at the Elbe and Tom, who works in shifts;
 * Lea as planner. The test clock stands on Monday 21 September 2026.
 */
export const elbblick = async (server = testServer()) => {
  const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  await mia.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });
  const standort = await json(
    await mia.anfrage("/api/v1/standorte", { body: { name: "Elbe", land: "HH" } }),
  );
  const tom = await server.eingeladen(mia, "mitarbeiter", "tom");
  const lea = await server.eingeladen(mia, "planer", "lea");
  return { server, mia, tom, lea, standortId: standort.standortId as string };
};

export const schichtVon = (standortId: string, nutzerId: string | null, tag = "2026-11-23") => ({
  standortId,
  tag,
  beginnMinute: 14 * 60,
  endeMinute: 22 * 60,
  pauseMinuten: 30,
  rolle: "Service",
  nutzerId,
});

/** A browser of a person in the tests */
export type Browser = {
  anfrage: (pfad: string, init?: { method?: string; body?: unknown }) => Promise<Response>;
};

/**
 * Café Elbblick with the push service and SMTP stood in (CLAUDE.md), for the messages of S-503: Mia
 * has an e-mail address, Tom and Lea were invited without one
 */
export const elbblickMitBoten = async () => {
  const smtp = await smtpTestServer();
  const geraete = new Map<string, ReturnType<typeof testAbo>>();
  const vapid = { oeffentlich: "" };
  const dienst = pushDienstErsatz(() => vapid.oeffentlich, geraete);
  const server = testServer({
    mail: smtpMailer(smtp.url, "Soll <soll@elbblick.test>"),
    push: dienst.senden,
  });
  vapid.oeffentlich = server.vapid.oeffentlich;
  const elbe = await elbblick(server);
  /** A device of the person subscribes to Web Push, in the app's language there */
  const abonnieren = async (wer: Browser, name: string, sprache = "de") => {
    const geraet = testAbo(`https://fcm.googleapis.com/fcm/send/${name}`);
    geraete.set(geraet.json.endpoint, geraet);
    const antwort = await wer.anfrage("/api/v1/arbeitszeit/erinnerungen/abos", {
      body: { ...geraet.json, sprache },
    });
    if (antwort.status >= 300) throw new Error(`abonnieren ${antwort.status}`);
  };
  return { ...elbe, smtp, zugestellt: dienst.zugestellt, abonnieren };
};

/** Plans a shift and answers it */
export const planen = async (wer: Browser, body: ReturnType<typeof schichtVon>) =>
  json(await wer.anfrage("/api/v1/dienstplan/schichten", { body }));

/** Publishes the week around a day at a site */
export const veroeffentlichen = (wer: Browser, standortId: string, tag = "2026-11-23") =>
  wer.anfrage("/api/v1/dienstplan/veroeffentlichen", { body: { standortId, tag } });
