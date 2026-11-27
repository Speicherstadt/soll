import { Badge, Icon } from "@soll/ui";
import { Briefcase, Building2, Wrench } from "lucide";
import { For, Show } from "solid-js";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import type { ProjektQuelle } from "./quelle.ts";
import { projekteUebersichtDaten } from "./uebersichtDaten.ts";

const RING_RADIUS = 17;
const RING_UMFANG = 2 * Math.PI * RING_RADIUS;

const BudgetRing = (props: { prozent: number; warnung: boolean }) => {
  const offset = () => RING_UMFANG * (1 - Math.max(0, Math.min(100, props.prozent)) / 100);
  return (
    <div aria-hidden="true" class="relative flex size-11 shrink-0 items-center justify-center">
      <svg class="-rotate-90 size-11" viewBox="0 0 44 44">
        <title>{`${props.prozent} %`}</title>
        <circle
          cx="22"
          cy="22"
          r={RING_RADIUS}
          fill="none"
          stroke="var(--muted)"
          stroke-width="4"
        />
        <circle
          cx="22"
          cy="22"
          r={RING_RADIUS}
          fill="none"
          stroke={props.warnung ? "var(--warning)" : "var(--primary)"}
          stroke-width="4"
          stroke-linecap="round"
          stroke-dasharray={String(RING_UMFANG)}
          stroke-dashoffset={String(offset())}
        />
      </svg>
      <span class="absolute font-mono font-semibold text-[10px] tabular-nums">
        {`${props.prozent}%`}
      </span>
    </div>
  );
};

/**
 * Rich visual KPI widget strip above /projekte tabs:
 * - Orders widget with SVG budget utilization ring & consumed/total hours
 * - Customers widget with active customer distribution chips
 * - Activities widget with billable ratio bar & activity chips
 * All 3 cards share identical <dt> height (min-h-6), aligned baselines, and equal card height.
 */
export const ProjekteUebersicht = (props: { quelle: ProjektQuelle }) => {
  const stand = () =>
    projekteUebersichtDaten({
      projekte: props.quelle.projekte(),
      kunden: props.quelle.kunden(),
      taetigkeiten: props.quelle.taetigkeiten(),
    });

  return (
    <dl
      class={`grid grid-cols-1 gap-3 ${props.quelle.verwalten ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
    >
      <div class="flex h-full flex-col gap-2 rounded-xl border border-border bg-background p-4">
        <dt class="flex min-h-6 items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span class="flex items-center gap-1.5">
            <Icon icon={Briefcase} class="size-3.5 shrink-0 text-muted-foreground" />
            <span>{m.projekte_tab_auftraege()}</span>
          </span>
          <Show when={stand().budgetWarnungen > 0}>
            <Badge ton="warning">
              {stand().budgetWarnungen} {m.budget_stufe_warnung()}
            </Badge>
          </Show>
        </dt>
        <dd class="flex flex-1 items-center justify-between gap-3">
          <div class="flex flex-col gap-1">
            <span class="font-mono font-semibold text-[24px] tabular-nums leading-none" dir="ltr">
              {stand().aktiveAuftraege}
            </span>
            <Show when={stand().budgetGesamtMinuten > 0}>
              <span class="font-mono text-[12px] text-muted-foreground tabular-nums" dir="ltr">
                {`${dauerText(stand().budgetVerbrauchtMinuten)} / ${dauerText(stand().budgetGesamtMinuten)}`}
              </span>
            </Show>
          </div>
          <Show when={stand().budgetAnteilProzent !== null}>
            <BudgetRing
              prozent={stand().budgetAnteilProzent ?? 0}
              warnung={stand().budgetWarnungen > 0}
            />
          </Show>
        </dd>
      </div>

      <Show when={props.quelle.verwalten}>
        <div class="flex h-full flex-col gap-2 rounded-xl border border-border bg-background p-4">
          <dt class="flex min-h-6 items-center gap-1.5 text-[12px] text-muted-foreground">
            <Icon icon={Building2} class="size-3.5 shrink-0 text-muted-foreground" />
            <span>{m.projekte_tab_kunden()}</span>
          </dt>
          <dd class="flex flex-1 flex-col justify-between gap-2">
            <span class="font-mono font-semibold text-[24px] tabular-nums leading-none" dir="ltr">
              {stand().aktiveKunden}
            </span>
            <Show when={stand().topKunden.length > 0}>
              <div class="flex flex-wrap gap-1.5">
                <For each={stand().topKunden}>
                  {(k) => (
                    <span class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      <span class="max-w-32 truncate text-foreground">{k.name}</span>
                      <span class="font-mono tabular-nums">· {k.auftraege}</span>
                    </span>
                  )}
                </For>
              </div>
            </Show>
          </dd>
        </div>
      </Show>

      <div class="flex h-full flex-col gap-2 rounded-xl border border-border bg-background p-4">
        <dt class="flex min-h-6 items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span class="flex items-center gap-1.5">
            <Icon icon={Wrench} class="size-3.5 shrink-0 text-muted-foreground" />
            <span>{m.projekte_tab_taetigkeiten()}</span>
          </span>
          <Show when={stand().aktiveTaetigkeiten > 0}>
            <span class="font-mono text-[11px] text-muted-foreground tabular-nums">
              {`${stand().abrechenbarProzent}% ${m.taetigkeit_abrechenbar()}`}
            </span>
          </Show>
        </dt>
        <dd class="flex flex-1 flex-col justify-between gap-2">
          <div class="flex items-center justify-between gap-3">
            <span class="font-mono font-semibold text-[24px] tabular-nums leading-none" dir="ltr">
              {stand().aktiveTaetigkeiten}
            </span>
            <div class="flex flex-wrap justify-end gap-1">
              <For each={stand().taetigkeitNamen}>
                {(name) => (
                  <span class="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {name}
                  </span>
                )}
              </For>
            </div>
          </div>
          <div aria-hidden="true" class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${stand().abrechenbarProzent}%` }}
            />
          </div>
        </dd>
      </div>
    </dl>
  );
};
