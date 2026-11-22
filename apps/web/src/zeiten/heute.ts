import type { Stempelart } from "@soll/arbeitszeit";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createSignal, onSettled } from "solid-js";
import { api } from "../api.ts";
import { offlineSchlange } from "../offline/schlange.ts";
import { m } from "../paraglide/messages.js";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { TAG_AENDERT, tagQuelle } from "./quelle.ts";

/**
 * Stamping on Heute: the running day from the server, the device's offline queue beside it (S-305),
 * and one function for a tap on a button. Soll never stamps by itself (CLAUDE.md).
 */
export const heuteStempeln = () => {
  const client = useQueryClient();
  // the person and business of the session, never of a day kept on the device: on a shared browser
  // that day may be the previous person's (a business kept from before S-305 names no person)
  const konto = () => {
    const betrieb = aktuellerBetrieb();
    return betrieb?.nutzerId ? { betriebId: betrieb.betriebId, nutzerId: betrieb.nutzerId } : null;
  };
  // the queue reads the day's distance to the server's clock only when asked
  let quelle: ReturnType<typeof tagQuelle> | undefined;
  const schlange = offlineSchlange(konto, () => quelle?.abstand() ?? 0);
  const tag = tagQuelle(() => ({}), schlange.offline);
  quelle = tag;
  const [fehler, setFehler] = createSignal("");

  /** What a stamp changes: the day (here and on Zeiten) and its month */
  const neuLaden = async () => {
    await Promise.all(TAG_AENDERT.map((queryKey) => client.invalidateQueries({ queryKey })));
  };
  // what waits from before (another visit, another tab) goes out once Heute shows
  onSettled(() => {
    void schlange.auffrischen().then(() => schlange.senden(neuLaden));
  });
  schlange.wiederholen(neuLaden);

  /**
   * A stamp goes into the device's queue first, numbered and signed, and out at once if the network
   * allows; without a network it waits and Heute counts on with it. Without the queue (no WebCrypto
   * or IndexedDB) a stamp goes live only, as before S-305. Resolves with the error to show, if any.
   */
  const vorgang = useMutation(() => ({
    mutationFn: async (art: Stempelart): Promise<string> => {
      const eintrag = await schlange.aufnehmen(art);
      if (eintrag) {
        await schlange.senden(neuLaden, eintrag.nummer);
        return "";
      }
      const antwort = await api("/api/v1/arbeitszeit/stempelungen", {
        body: { art, geraetZeitpunkt: Date.now() },
      });
      if (!antwort.ok) return m.stempeln_fehler();
      await neuLaden();
      return "";
    },
  }));

  /** The buttons stay disabled until the new state shows: the old one would offer the same step */
  const stempeln = async (art: Stempelart) => {
    if (vorgang.isPending) return;
    setFehler(await vorgang.mutate(art));
  };

  return { quelle: tag, schlange, fehler, arbeitet: () => vorgang.isPending, stempeln };
};
