import { type Tagesstand, tagesstand } from "@soll/arbeitszeit";
import { useQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, onSettled } from "solid-js";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { mitWartenden } from "../offline/heute.ts";
import { type Geladen, type Offline, tagHolen } from "./holen.ts";
import type { TagAnsicht } from "./typen.ts";

/** How often the running day counts on: the minutes change once a minute */
const TAKT_MS = 15_000;

/** What a change to stamps changes: every day shown and its month */
export const TAG_AENDERT = [alle(PFAD.tag), alle(PFAD.monat)];

export type Anfrage = { datum?: string | undefined; nutzerId?: string | undefined };

/**
 * A working day from the server (GET /api/v1/arbeitszeit/tag, a query per day and person), counted
 * on with the same pure function the server uses (`tagesstand`), on the server's clock: the device's
 * clock may be wrong, so the app keeps only its distance to the server's. Read `ansicht` and `stand`
 * under `<Loading>`.
 */
export const tagQuelle = (anfrage: () => Anfrage, offline?: Offline) => {
  const [jetzt, setJetzt] = createSignal(Date.now());
  // the distance as last answered, for the queue's imperative reads (they must never wait)
  const [abstand, setAbstand] = createSignal(0);
  const ressource = () => ressourcen.tag(anfrage());
  const abfrage = useQuery(() => {
    const r = ressource();
    return {
      queryKey: r.schluessel,
      queryFn: async ({ client, queryKey }) => {
        const neu = await tagHolen(r.pfad, offline, client.getQueryData<Geladen>(queryKey));
        setAbstand(neu.abstand);
        setJetzt(Date.now() + neu.abstand);
        return neu;
      },
    };
  });
  onSettled(() => {
    const takt = setInterval(() => setJetzt(Date.now() + abstand()), TAKT_MS);
    return () => clearInterval(takt);
  });
  /** the day with what still waits on this device (only on Heute), as the server would show it */
  const ansicht = createMemo((): TagAnsicht | null => {
    const tag = abfrage.data.ansicht;
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
  return {
    ansicht,
    stand,
    fehler: () => abfrage.data.fehler,
    ohneNetz: () => abfrage.data.ohneNetz,
    abstand,
    /** what changes this day; the query loads it again */
    schluessel: () => ressource().schluessel,
  };
};
