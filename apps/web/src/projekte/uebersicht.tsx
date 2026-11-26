import { Badge, Icon } from "@soll/ui";
import { Briefcase, Building2, Wrench } from "lucide";
import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import type { ProjektQuelle } from "./quelle.ts";
import { projekteUebersichtDaten } from "./uebersichtDaten.ts";

/**
 * Compact KPI summary strip above the /projekte tabs: active orders (with budget-warning badge),
 * active customers (when managing), and active billable/total activities.
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
      <div class="flex flex-col gap-1 rounded-xl border border-border bg-background p-4">
        <dt class="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
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
        <dd class="font-mono font-semibold text-[22px] tabular-nums" dir="ltr">
          {stand().aktiveAuftraege}
        </dd>
      </div>

      <Show when={props.quelle.verwalten}>
        <div class="flex flex-col gap-1 rounded-xl border border-border bg-background p-4">
          <dt class="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Icon icon={Building2} class="size-3.5 shrink-0 text-muted-foreground" />
            <span>{m.projekte_tab_kunden()}</span>
          </dt>
          <dd class="font-mono font-semibold text-[22px] tabular-nums" dir="ltr">
            {stand().aktiveKunden}
          </dd>
        </div>
      </Show>

      <div class="flex flex-col gap-1 rounded-xl border border-border bg-background p-4">
        <dt class="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span class="flex items-center gap-1.5">
            <Icon icon={Wrench} class="size-3.5 shrink-0 text-muted-foreground" />
            <span>{m.projekte_tab_taetigkeiten()}</span>
          </span>
          <Show when={stand().abrechenbareTaetigkeiten > 0}>
            <span class="text-[11px] text-muted-foreground tabular-nums">
              {stand().abrechenbareTaetigkeiten} {m.taetigkeit_abrechenbar()}
            </span>
          </Show>
        </dt>
        <dd class="font-mono font-semibold text-[22px] tabular-nums" dir="ltr">
          {stand().aktiveTaetigkeiten}
        </dd>
      </div>
    </dl>
  );
};
