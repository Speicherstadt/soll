import type { Stempelart } from "@soll/arbeitszeit";
import { createSignal, onSettled } from "solid-js";
import { api } from "../api.ts";
import type { Offline } from "../zeiten/holen.ts";
import type { Stempel } from "../zeiten/typen.ts";
import { indexedDbAblage } from "./ablage.ts";
import { type Abhaengigkeiten, type Versand, warteschlange } from "./dienst.ts";
import {
  abgelehnte,
  alsStempel,
  type Eintrag,
  type Konto,
  kontoSchluessel,
  wartende,
} from "./warteschlange.ts";

/** How often the queue tries again while something waits, besides when the browser goes online */
const WIEDER_MS = 30_000;

/** Web Locks across the app's tabs where the browser has them; one tab alone needs none */
const sperre = <T>(arbeit: () => Promise<T>): Promise<T> =>
  typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request("soll-warteschlange", arbeit)
    : arbeit();

/**
 * The browser's parts for the queue, or null where it has none: WebCrypto needs a secure context
 * (HTTPS or localhost), IndexedDB may be blocked; without them Heute stamps live as before
 */
const imBrowser = (): Abhaengigkeiten | null =>
  globalThis.crypto?.subtle && globalThis.indexedDB
    ? {
        ablage: indexedDbAblage(),
        subtle: crypto.subtle,
        api,
        jetzt: Date.now,
        sperre,
        neueId: () => crypto.randomUUID(),
      }
    : null;

/** One queue and one connection to IndexedDB for the whole app */
let geteilt:
  | { abh: Abhaengigkeiten; schlange: ReturnType<typeof warteschlange> }
  | null
  | undefined;
const imBrowserGeteilt = () => {
  if (geteilt === undefined) {
    const abh = imBrowser();
    geteilt = abh && { abh, schlange: warteschlange(abh) };
  }
  return geteilt;
};

/**
 * The offline queue of Heute for the person signed in (S-305): what waits and what the server
 * refused, taking a stamp in and sending; it tries again when the browser goes online and every
 * 30 seconds while something waits. `konto` is the person and business of the session, null until
 * they are known; the queue and the day kept on the device belong to that person alone, so the next
 * person on a shared browser never sees or sends them.
 */
export const offlineSchlange = (konto: () => Konto | null, abstand: () => number) => {
  const browser = imBrowserGeteilt();
  const schlange = browser?.schlange ?? null;
  const ablage = browser?.abh.ablage ?? null;
  const [eintraege, setEintraege] = createSignal<Eintrag[]>([]);
  const [ohneNetz, setOhneNetz] = createSignal(
    typeof navigator !== "undefined" && navigator.onLine === false,
  );
  const schluessel = () => {
    const k = konto();
    return k && kontoSchluessel(k);
  };
  const auffrischen = async () => {
    const k = schluessel();
    setEintraege(schlange && k ? await schlange.eintraege(k).catch(() => []) : []);
  };
  /** The stamp in the queue, or null where there is none (then the caller stamps live) */
  const aufnehmen = async (art: Stempelart): Promise<Eintrag | null> => {
    const k = schluessel();
    if (!schlange || !k) return null;
    return schlange.aufnehmen(k, art).catch(() => null);
  };
  /**
   * Sends what waits; `danach` reloads the day once something went out, before the queue shows its
   * new state, so a stamp moves from waiting to the server's list without showing twice or not at all
   */
  const senden = async (danach: () => Promise<void>, live: number | null = null) => {
    const k = schluessel();
    const versand =
      schlange && k
        ? await schlange
            .uebertragen(k, live)
            .catch((): Versand => ({ uebertragen: 0, wartend: wartende(eintraege()).length }))
        : { uebertragen: 0, wartend: 0 };
    if (versand.uebertragen > 0) await danach();
    await auffrischen();
  };
  const offline: Offline = {
    wartende: (): Stempel[] => {
      const k = konto();
      return k ? alsStempel(eintraege(), k.nutzerId, abstand()) : [];
    },
    merken: async (tag) => {
      const k = konto();
      // a day of someone else (the session changed while it loaded) is not kept as this person's
      if (ablage && k && tag.ansicht.nutzerId === k.nutzerId)
        await ablage.tagSetzen(kontoSchluessel(k), tag);
    },
    gemerkt: async () => {
      const k = konto();
      return ablage && k ? ablage.tag(kontoSchluessel(k)) : undefined;
    },
  };
  return {
    offline,
    verfuegbar: schlange !== null,
    wartende: () => wartende(eintraege()),
    abgelehnte: () => abgelehnte(eintraege()),
    auffrischen,
    aufnehmen,
    senden,
    /** whether the browser says it has no network (the queue keeps the stamps meanwhile) */
    ohneNetz,
    /** starts trying again on `online` and on a timer; `danach` as in `senden` */
    wiederholen: (danach: () => Promise<void>) =>
      onSettled(() => {
        const versuchen = () => {
          setOhneNetz(!navigator.onLine);
          if (wartende(eintraege()).length > 0) void senden(danach);
        };
        const takt = setInterval(versuchen, WIEDER_MS);
        globalThis.addEventListener("online", versuchen);
        globalThis.addEventListener("offline", versuchen);
        return () => {
          clearInterval(takt);
          globalThis.removeEventListener("online", versuchen);
          globalThis.removeEventListener("offline", versuchen);
        };
      }),
  };
};
