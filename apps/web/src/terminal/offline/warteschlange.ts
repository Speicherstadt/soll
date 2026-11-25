import type { Stempelart } from "@soll/arbeitszeit";
import { createSignal, onSettled } from "solid-js";
import { api } from "../../api.ts";
import type { Kopplung } from "../typen.ts";
import { kioskIndexedDb, type Schluessel } from "./ablage.ts";
import { type KioskAbhaengigkeiten, kioskSchlange } from "./dienst.ts";
import type { KioskEintrag, OfflineAusweis } from "./schlange.ts";

/** How often the queue tries again while something waits, besides when the browser goes online */
export const WIEDER_MS = 30_000;

/** Web Locks where the browser has them; one tab alone needs none */
const sperre = <T>(arbeit: () => Promise<T>): Promise<T> =>
  typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request("soll-kiosk-warteschlange", arbeit)
    : arbeit();

/**
 * The browser's parts for the queue, or null where it has none: WebCrypto needs a secure context
 * (HTTPS or localhost), IndexedDB may be blocked; without them the kiosk stamps online only
 */
const imBrowser = (): ReturnType<typeof kioskSchlange> | null => {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) return null;
  const abh: KioskAbhaengigkeiten = {
    ablage: kioskIndexedDb(),
    subtle: crypto.subtle,
    api,
    jetzt: Date.now,
    sperre,
  };
  return kioskSchlange(abh);
};

/**
 * The tablet's offline queue in the kiosk (S-803): whether the server is out of reach, how many
 * entries wait and when the server last took one; taking a stamp in and sending what waits, when
 * the browser goes online, every 30 seconds while something waits, and after each new entry.
 * `entkoppelt` is called when the server says the terminal was revoked.
 */
export const kioskWarteschlange = (kopplung: () => Kopplung | null, entkoppelt: () => void) => {
  const schlange = imBrowser();
  const [wartend, setWartend] = createSignal(0);
  const [zuletzt, setZuletzt] = createSignal<number | null>(null);
  const [bereit, setBereit] = createSignal(false);
  const [ohneNetz, setOhneNetz] = createSignal(
    typeof navigator !== "undefined" && navigator.onLine === false,
  );
  const auffrischen = async () => {
    const k = kopplung();
    if (!schlange || !k) return;
    const stand = await schlange.stand(k.terminalId).catch(() => null);
    if (stand) {
      setWartend(stand.wartend);
      setZuletzt(stand.zuletzt);
    }
    setBereit(await schlange.bereit(k.terminalId));
  };
  const senden = async () => {
    const k = kopplung();
    if (!schlange || !k) return;
    const versand = await schlange.uebertragen(k.token, k.terminalId).catch(() => null);
    if (versand?.entkoppelt) entkoppelt();
    if (versand && versand.erledigt > 0) setOhneNetz(false);
    await auffrischen();
  };
  /** With the server's key from GET /api/v1/kiosk: the key pair made and registered, then sending */
  const vorbereiten = async (k: Kopplung, server: Schluessel) => {
    if (!schlange) return;
    await schlange.vorbereiten(k.token, k.terminalId, server).catch(() => undefined);
    await senden();
  };
  const aufnehmen = async (
    ausweis: OfflineAusweis,
    art: Stempelart,
  ): Promise<KioskEintrag | null> => {
    const k = kopplung();
    if (!schlange || !k) return null;
    const eintrag = await schlange.aufnehmen(k.terminalId, ausweis, art).catch(() => null);
    await auffrischen();
    void senden();
    return eintrag;
  };
  onSettled(() => {
    void auffrischen();
    const versuchen = () => {
      setOhneNetz(!navigator.onLine);
      if (wartend() > 0) void senden();
    };
    const takt = setInterval(versuchen, WIEDER_MS);
    globalThis.addEventListener("online", versuchen);
    globalThis.addEventListener("offline", versuchen);
    return () => {
      clearInterval(takt);
      globalThis.removeEventListener("online", versuchen);
      globalThis.removeEventListener("offline", versuchen);
    };
  });
  return {
    wartend,
    zuletzt,
    ohneNetz,
    /** whether a stamp can wait here: the tablet has its key and the server's */
    bereit,
    vorbereiten,
    aufnehmen,
    /** what a call of the kiosk's API answered: status 0 is no network, anything else is */
    netz: (status: number) => setOhneNetz(status === 0),
  };
};

export type KioskWarteschlange = ReturnType<typeof kioskWarteschlange>;
