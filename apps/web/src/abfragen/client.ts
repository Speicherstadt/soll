import { QueryClient } from "@tanstack/solid-query";

/**
 * The settings of the app's query cache (TanStack Query, docs/plan.md "Daten im Client"):
 *
 * - A query function never throws: it returns the API's answer, errors as values (api.ts), so a
 *   refusal or no network shows the same texts as before and nothing reaches an error boundary.
 *   Retrying would only delay "no network": the offline queue (S-305) sends again by itself.
 * - `networkMode: "always"`: offline the question still goes out and comes back as "no network"
 *   (status 0); the default would pause it and the page would wait forever.
 * - No refetch on focus or reconnect: a tablet terminal gains and loses focus all day, and after a
 *   reconnect the offline queue sends what waits and reloads what it changed.
 */
export const neuerClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        networkMode: "always",
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false, networkMode: "always" },
    },
  });

/** The one query cache of the app (main.tsx provides it; the session clears it on a change of person) */
export const abfrageCache = neuerClient();
