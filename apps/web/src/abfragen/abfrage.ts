import { type QueryClient, skipToken, useMutation, useQuery } from "@tanstack/solid-query";
import { type Antwort, api } from "../api.ts";
import type { Ressource, Schluessel } from "./schluessel.ts";

/**
 * The API's answer as a query keeps it: a failed load again (a refusal, no network) keeps the data
 * last loaded for the same key as `letzte`, so the page goes on showing it beside the error notice
 */
export type Abgefragt<T> =
  | { ok: true; status: number; daten: T }
  | { ok: false; status: number; fehler: string; letzte?: T };

/** The data of an answer, the data last loaded after a failed load again, or nothing */
export const daten = <T>(antwort: Abgefragt<T>): T | undefined =>
  antwort.ok ? antwort.daten : antwort.letzte;

/** A new answer for a key, keeping what the answer before it had loaded when this one failed */
export const behalten = <T>(neu: Antwort<T>, vorher: Abgefragt<T> | undefined): Abgefragt<T> => {
  if (neu.ok) return neu;
  const letzte = vorher === undefined ? undefined : daten(vorher);
  return letzte === undefined ? neu : { ...neu, letzte };
};

/**
 * A resource as a query (docs/entwicklung.md, "Daten laden"). Its data is the API's answer, errors as
 * values: read it under `<Loading>` (the first load suspends there), then branch on `ok`; `daten`
 * keeps the data last loaded through a failed load again. Without a resource (nothing chosen yet)
 * nothing is asked; such a read waits, so it belongs behind a `Show`.
 */
export const abfrage = <T>(ressource: () => Ressource | null) =>
  useQuery(() => {
    const r = ressource();
    return {
      queryKey: r?.schluessel ?? ["-"],
      queryFn: r
        ? async ({ client, queryKey }: { client: QueryClient; queryKey: readonly unknown[] }) =>
            behalten(await api<T>(r.pfad), client.getQueryData<Abgefragt<T>>(queryKey))
        : skipToken,
    };
  });

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
  client.setQueryData<Abgefragt<Record<string, E[]>>>(ressource.schluessel, (alt) => ({
    ok: true,
    status: 200,
    daten: { [feld]: aendern((alt === undefined ? undefined : daten(alt)?.[feld]) ?? []) },
  }));
};
