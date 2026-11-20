import { type Tagesstand, tagesstand } from "@soll/arbeitszeit";
import { createMemo, createSignal, onSettled } from "solid-js";
import { api } from "../api.ts";
import type { GemerkterTag } from "../offline/ablage.ts";
import { mitWartenden } from "../offline/heute.ts";
import type { Stempel, TagAnsicht } from "./typen.ts";

/** How often the running day counts on: the minutes change once a minute */
const TAKT_MS = 15_000;

type Anfrage = { datum?: string | undefined; nutzerId?: string | undefined };

/**
 * For one's own running day on Heute (S-305): the stamps still waiting in the device's queue, and
 * the day as last loaded, kept on the device, so Heute opens and counts on without a network
 */
export type Offline = {
  wartende: () => Stempel[];
  merken: (tag: GemerkterTag) => Promise<void>;
  gemerkt: () => Promise<GemerkterTag | undefined>;
};

/**
 * A working day from the server (GET /api/v1/arbeitszeit/tag), counted on with the same pure
 * function the server uses (`tagesstand`), on the server's clock: the device's clock may be wrong,
 * so the app keeps only its distance to the server's
 */
export const tagQuelle = (offline?: Offline) => {
  const [geladen, setGeladen] = createSignal<TagAnsicht | null>(null);
  const [fehler, setFehler] = createSignal("");
  const [ohneNetz, setOhneNetz] = createSignal(false);
  const [jetzt, setJetzt] = createSignal(Date.now());
  const [abstand, setAbstand] = createSignal(0);
  let zaehler = 0;
  let zuletzt: Anfrage = {};
  /** The day last seen, when the server cannot be reached: only one's own running day is kept */
  const ausGedaechtnis = async (): Promise<boolean> => {
    const tag = offline ? await offline.gemerkt().catch(() => undefined) : undefined;
    if (!tag) return false;
    setAbstand(tag.abstand);
    setJetzt(Date.now() + tag.abstand);
    setGeladen(tag.ansicht);
    return true;
  };
  /** Loads the day asked for; without a question the one asked last again */
  const laden = async (anfrage: Anfrage = zuletzt) => {
    zuletzt = anfrage;
    const { datum, nutzerId } = anfrage;
    const parameter = new URLSearchParams({
      ...(datum ? { datum } : {}),
      ...(nutzerId ? { nutzerId } : {}),
    });
    const diese = ++zaehler;
    const antwort = await api<TagAnsicht>(`/api/v1/arbeitszeit/tag?${parameter}`);
    // a later question was asked meanwhile (another day or person): its answer counts
    if (diese !== zaehler) return;
    setOhneNetz(!antwort.ok && antwort.status === 0);
    if (!antwort.ok) {
      if (antwort.status === 0 && (geladen() || (await ausGedaechtnis()))) return setFehler("");
      return setFehler(antwort.fehler);
    }
    const neu = antwort.daten.jetzt - Date.now();
    setAbstand(neu);
    setFehler("");
    setJetzt(antwort.daten.jetzt);
    setGeladen(antwort.daten);
    void offline?.merken({ ansicht: antwort.daten, abstand: neu }).catch(() => undefined);
  };
  onSettled(() => {
    const takt = setInterval(() => setJetzt(Date.now() + abstand()), TAKT_MS);
    return () => clearInterval(takt);
  });
  /** the day with what still waits on this device (only on Heute), as the server would show it */
  const ansicht = createMemo((): TagAnsicht | null => {
    const tag = geladen();
    if (!tag) return null;
    return mitWartenden(tag, offline?.wartende() ?? [], Math.max(jetzt(), tag.jetzt));
  });
  const stand = createMemo((): Tagesstand | null => {
    const tag = ansicht();
    if (!tag) return null;
    const spaetester = Math.max(0, ...tag.umfeld.map((stempel) => stempel.zeitpunkt));
    const neu = tagesstand(tag.umfeld, Math.max(jetzt(), tag.jetzt, spaetester), tag.tag);
    return neu.ok ? neu.wert : tag.stand;
  });
  return { ansicht, stand, fehler, ohneNetz, abstand, laden };
};
