import { testServer } from "../test-server.ts";
import {
  type Browser,
  elbblick,
  elbblickMitBoten,
  json,
  planen,
  schichtVon,
  veroeffentlichen,
} from "./dienstplan-testhilfen.ts";

/*
 * Helpers of the tests of the shift swap (S-504): Café Elbblick with Tom's published late shift on
 * Monday 23 November and Yusuf and Olena, who work there too. The test clock stands on Monday 21
 * September 2026.
 */

export const TAUSCH = "/api/v1/dienstplan/tausch";

export type TauschAntwort = {
  tauschId: string;
  status: string;
  schichtId: string;
  uebernehmerId: string | null;
  grund: string | null;
};

const mitTausch = async <T extends Awaited<ReturnType<typeof elbblick>>>(c: T) => {
  const yusuf = await c.server.eingeladen(c.mia, "mitarbeiter", "yusuf");
  const olena = await c.server.eingeladen(c.mia, "mitarbeiter", "olena");
  const schicht = await planen(c.lea, schichtVon(c.standortId, c.tom.nutzerId));
  await veroeffentlichen(c.lea, c.standortId);
  return { ...c, yusuf, olena, schichtId: schicht.schichtId as string };
};

/** Café Elbblick with Tom's published shift, Yusuf and Olena */
export const elbblickZumTausch = async (server = testServer()) => mitTausch(await elbblick(server));

/** The same with the push service and SMTP stood in (CLAUDE.md) */
export const elbblickZumTauschMitBoten = async () => mitTausch(await elbblickMitBoten());

/** Offers a shift, to everyone or to one colleague */
export const anbieten = (wer: Browser, schichtId: string, anNutzerId: string | null = null) =>
  wer.anfrage(TAUSCH, { body: { schichtId, anNutzerId } });

/** A step of a swap: take it over, approve it, refuse it with a reason */
export const schritt = (
  wer: Browser,
  tauschId: string,
  was: "uebernehmen" | "freigeben" | "ablehnen",
  body: unknown = {},
) => wer.anfrage(`${TAUSCH}/${tauschId}/${was}`, { body });

/** Offers and answers the swap */
export const angeboten = async (wer: Browser, schichtId: string, an: string | null = null) =>
  (await json(await anbieten(wer, schichtId, an))) as TauschAntwort;

/** What a person reads of the swaps */
export const tauschbuchVon = async (wer: Browser) =>
  (await json(await wer.anfrage(TAUSCH))) as {
    tausche: {
      tauschId: string;
      status: string;
      grund: string | null;
      befunde: { regel: string; norm: string; schwere: string }[] | null;
      uebernehmer: { nutzerId: string; name: string } | null;
    }[];
    anbietbar: { schichtId: string }[];
    kollegen: { nutzerId: string; name: string }[];
    ohneFreigabe: boolean;
  };

/** The person of a shift in the week of 23 November as whoever plans sees it */
export const personDer = async (wer: Browser, standortId: string, schichtId: string) => {
  const woche = await json(
    await wer.anfrage(`/api/v1/dienstplan/woche?standortId=${standortId}&tag=2026-11-23`),
  );
  return (woche.schichten as { schichtId: string; nutzerId: string | null }[]).find(
    (s) => s.schichtId === schichtId,
  );
};
