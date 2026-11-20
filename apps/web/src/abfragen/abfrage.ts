import { type QueryClient, skipToken, useMutation, useQuery } from "@tanstack/solid-query";
import { type Antwort, api } from "../api.ts";
import type { Ressource, Schluessel } from "./schluessel.ts";

/**
 * A resource as a query (docs/entwicklung.md, "Daten laden"). Its data is the API's answer, errors as
 * values: read it under `<Loading>` (the first load suspends there), then branch on `ok`. Without a
 * resource (nothing chosen yet) nothing is asked; such a read waits, so it belongs behind a `Show`.
 */
export const abfrage = <T>(ressource: () => Ressource | null) =>
  useQuery(() => {
    const r = ressource();
    return {
      queryKey: r?.schluessel ?? ["-"],
      queryFn: r ? () => api<T>(r.pfad) : skipToken,
    };
  });

/** The data of an answer, or nothing for a refusal or no network */
export const daten = <T>(antwort: Antwort<T>): T | undefined =>
  antwort.ok ? antwort.daten : undefined;

type Optionen<V, T> = {
  /** invalidate after a refusal too (the server may have changed something all the same) */
  immer?: boolean;
  /** what the answer itself tells, written to the cache before the keys load again */
  eintragen?: (client: QueryClient, variablen: V, daten: T) => void;
};

/**
 * A write to the API that invalidates the keys it changes, so every page showing them loads them
 * again. The invalidation runs inside the mutation's action: the write's end and the fresh data
 * show together. `mutate` resolves with the answer; a refusal invalidates only with `immer`.
 */
export const aenderung = <V, T = unknown>(
  senden: (variablen: V) => Promise<Antwort<T>>,
  betrifft: (variablen: V, antwort: Antwort<T>) => readonly Schluessel[],
  optionen: Optionen<V, T> = {},
) =>
  useMutation(() => ({
    mutationFn: senden,
    onSuccess: async (antwort: Antwort<T>, variablen: V, _: unknown, kontext) => {
      if (antwort.ok) optionen.eintragen?.(kontext.client, variablen, antwort.daten);
      if (!antwort.ok && !optionen.immer) return;
      await Promise.all(
        betrifft(variablen, antwort).map((queryKey) =>
          kontext.client.invalidateQueries({ queryKey }),
        ),
      );
    },
  }));

/**
 * A write handed over as a function at the call, for a component with several kinds of writes that
 * change the same keys; `mutate` resolves with the answer
 */
export const schreiben = (
  betrifft: () => readonly Schluessel[],
  optionen: { immer?: boolean } = {},
) =>
  aenderung<() => Promise<Antwort<unknown>>, unknown>((auftrag) => auftrag(), betrifft, optionen);

/**
 * Changes a list in the cache at once. A write's own answer belongs on the list even while an
 * earlier load (read before the write) is still on its way: the invalidation that follows drops
 * that load and asks again.
 */
export const listeAendern = <E>(
  client: QueryClient,
  ressource: Ressource,
  feld: string,
  aendern: (liste: E[]) => E[],
): void => {
  client.setQueryData<Antwort<Record<string, E[]>>>(ressource.schluessel, (alt) => ({
    ok: true,
    status: 200,
    daten: { [feld]: aendern(alt?.ok ? (alt.daten[feld] ?? []) : []) },
  }));
};
