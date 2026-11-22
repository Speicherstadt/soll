import { api } from "../api.ts";
import type { GemerkterTag } from "../offline/ablage.ts";
import type { Stempel, TagAnsicht } from "./typen.ts";

/**
 * For one's own running day on Heute (S-305): the stamps still waiting in the device's queue, and
 * the day as last loaded, kept on the device, so Heute opens and counts on without a network
 */
export type Offline = {
  wartende: () => Stempel[];
  merken: (tag: GemerkterTag) => Promise<void>;
  gemerkt: () => Promise<GemerkterTag | undefined>;
};

/** A day as the query keeps it: the day (if any), its distance to the server's clock, what failed */
export type Geladen = {
  ansicht: TagAnsicht | null;
  abstand: number;
  fehler: string;
  ohneNetz: boolean;
};

/**
 * Asks the server for a day (the query function of `tagQuelle`). Without a network the day shown
 * stays (or, on Heute, the day kept on the device comes back); a refusal keeps the day shown and
 * names the error.
 */
export const tagHolen = async (
  pfad: string,
  offline: Offline | undefined,
  vorher: Geladen | undefined,
): Promise<Geladen> => {
  const antwort = await api<TagAnsicht>(pfad);
  if (antwort.ok) {
    const abstand = antwort.daten.jetzt - Date.now();
    void offline?.merken({ ansicht: antwort.daten, abstand }).catch(() => undefined);
    return { ansicht: antwort.daten, abstand, fehler: "", ohneNetz: false };
  }
  const ohneNetz = antwort.status === 0;
  if (ohneNetz && vorher?.ansicht) return { ...vorher, fehler: "", ohneNetz };
  const gemerkt = ohneNetz ? await offline?.gemerkt().catch(() => undefined) : undefined;
  if (gemerkt) return { ansicht: gemerkt.ansicht, abstand: gemerkt.abstand, fehler: "", ohneNetz };
  return {
    ansicht: vorher?.ansicht ?? null,
    abstand: vorher?.abstand ?? 0,
    fehler: antwort.fehler,
    ohneNetz,
  };
};
