import type { Stempelart } from "@soll/arbeitszeit";
import { createSignal, onSettled } from "solid-js";
import { api } from "../api.ts";
import { offlineSchlange } from "../offline/schlange.ts";
import { m } from "../paraglide/messages.js";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { tagQuelle } from "./quelle.ts";

/**
 * Stamping on Heute: the running day from the server, the device's offline queue beside it (S-305),
 * and one function for a tap on a button. Soll never stamps by itself (CLAUDE.md).
 */
export const heuteStempeln = () => {
  const betriebId = () => aktuellerBetrieb()?.betriebId ?? null;
  // the person comes with the day the server sent, or with the one kept on the device; the queue and
  // the day refer to each other, so each reads the other only when asked
  let quelle: ReturnType<typeof tagQuelle> | undefined;
  const konto = () => {
    const b = betriebId();
    const n = quelle?.nutzerId() ?? null;
    return b && n ? { betriebId: b, nutzerId: n } : null;
  };
  const schlange = offlineSchlange(konto, betriebId, () => quelle?.abstand() ?? 0);
  const tag = tagQuelle(schlange.offline);
  quelle = tag;
  const [fehler, setFehler] = createSignal("");
  const [arbeitet, setArbeitet] = createSignal(false);

  const neuLaden = async () => {
    await tag.laden();
  };
  /** Loads the day, then sends what waits from before (another visit, another tab) */
  const laden = async () => {
    await tag.laden();
    await schlange.auffrischen();
    await schlange.senden(neuLaden);
  };
  onSettled(() => {
    void laden();
  });
  schlange.wiederholen(neuLaden);

  /** Without the queue (no WebCrypto or IndexedDB) a stamp goes live only, as before S-305 */
  const live = async (art: Stempelart) => {
    const antwort = await api("/api/v1/arbeitszeit/stempelungen", {
      body: { art, geraetZeitpunkt: Date.now() },
    });
    if (!antwort.ok) return setFehler(m.stempeln_fehler());
    setFehler("");
    await tag.laden();
  };

  /**
   * A stamp goes into the device's queue first, numbered and signed, and out at once if the network
   * allows; without a network it waits and Heute counts on with it. The buttons stay disabled until
   * the new state shows: the old one would offer the same step.
   */
  const stempeln = async (art: Stempelart) => {
    if (arbeitet()) return;
    setArbeitet(true);
    try {
      const eintrag = await schlange.aufnehmen(art);
      if (!eintrag) return await live(art);
      setFehler("");
      await schlange.senden(neuLaden, eintrag.nummer);
    } finally {
      setArbeitet(false);
    }
  };

  return { quelle: tag, schlange, fehler, arbeitet, stempeln };
};
