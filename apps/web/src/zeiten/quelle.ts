import { type Tagesstand, tagesstand } from "@soll/arbeitszeit";
import { createMemo, createSignal, onSettled } from "solid-js";
import { api } from "../api.ts";
import type { TagAnsicht } from "./typen.ts";

/** How often the running day counts on: the minutes change once a minute */
const TAKT_MS = 15_000;

/**
 * A working day from the server (GET /api/v1/arbeitszeit/tag), counted on with the same pure
 * function the server uses (`tagesstand`), on the server's clock: the device's clock may be wrong,
 * so the app keeps only its distance to the server's
 */
type Anfrage = { datum?: string | undefined; nutzerId?: string | undefined };

export const tagQuelle = () => {
  const [ansicht, setAnsicht] = createSignal<TagAnsicht | null>(null);
  const [fehler, setFehler] = createSignal("");
  const [jetzt, setJetzt] = createSignal(Date.now());
  let abstand = 0;
  let zaehler = 0;
  let zuletzt: Anfrage = {};
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
    if (!antwort.ok) return setFehler(antwort.fehler);
    abstand = antwort.daten.jetzt - Date.now();
    setFehler("");
    setJetzt(antwort.daten.jetzt);
    setAnsicht(antwort.daten);
  };
  onSettled(() => {
    const takt = setInterval(() => setJetzt(Date.now() + abstand), TAKT_MS);
    return () => clearInterval(takt);
  });
  const stand = createMemo((): Tagesstand | null => {
    const tag = ansicht();
    if (!tag) return null;
    const neu = tagesstand(tag.umfeld, Math.max(jetzt(), tag.jetzt), tag.tag);
    return neu.ok ? neu.wert : tag.stand;
  });
  return { ansicht, stand, fehler, laden };
};
