import { istTag } from "@soll/arbeitszeit";
import { createFileRoute } from "@tanstack/solid-router";
import { Loading, Show } from "solid-js";
import { abfrage, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { Plan } from "../dienstplan/plan.tsx";
import type { Standort } from "../dienstplan/typen.ts";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";

/**
 * Dienstplan (S-501): the week of a site. Owner and planner plan the draft from templates, by drag
 * and drop or the keyboard, and see where the need per role is not covered; everyone else sees what
 * is published (S-503). On a phone one day at a time.
 */
const Dienstplan = () => {
  const standorte = abfrage<{ standorte: Standort[] }>(ressourcen.standorte);
  const liste = () => daten(standorte.data)?.standorte ?? [];
  const suche = Route.useSearch();
  return (
    <Seite titel={m.nav_dienstplan()}>
      <Loading>
        <Show when={liste().length > 0} fallback={<Leer text={m.plan_kein_standort()} />}>
          <Plan standorte={liste()} tag={suche().tag} />
        </Show>
      </Loading>
    </Seite>
  );
};

export const Route = createFileRoute("/dienstplan")({
  component: Dienstplan,
  // a link may name the week to open (?tag=2026-11-23); without one the plan opens this week
  validateSearch: (suche: Record<string, unknown>): { tag?: string } =>
    typeof suche.tag === "string" && istTag(suche.tag) ? { tag: suche.tag } : {},
});
