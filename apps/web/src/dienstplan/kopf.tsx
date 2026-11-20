import { Button, Icon } from "@soll/ui";
import { ChevronLeft, ChevronRight } from "lucide";
import { For, Show } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Feld } from "./felder.tsx";
import { zeitraumText } from "./text.ts";
import type { Standort, Woche } from "./typen.ts";

/**
 * The head of the plan (design/mockup/Dienstplan.dc.html): the week with its calendar week and
 * "Entwurf" while drafts show, the arrows to the week before and after, the site, and for whoever
 * plans the templates and the need. Publishing comes with S-503.
 */
export const PlanKopf = (props: {
  woche: Woche | null;
  standorte: readonly Standort[];
  standortId: string;
  planer: boolean;
  onWoche: (schritt: -1 | 1) => void;
  onStandort: (standortId: string) => void;
  onVorlagen: () => void;
  onBedarf: () => void;
}) => (
  <header class="flex flex-wrap items-end justify-between gap-3">
    <Show when={props.woche}>
      {(woche) => (
        <p class="text-muted-foreground">
          {m.plan_untertitel({
            kw: woche().kw.nummer,
            zeitraum: zeitraumText(woche().tage[0] ?? "", woche().tage[6] ?? ""),
          })}
          <Show when={woche().schichten.some((s) => s.veroeffentlichtAm === null)}>
            {" · "}
            {m.plan_entwurf()}
          </Show>
        </p>
      )}
    </Show>
    <div class="flex flex-wrap items-end gap-2">
      <Show when={props.standorte.length > 1}>
        <Feld
          label={m.plan_standort()}
          kind={(id) => (
            <select
              id={id}
              class={feld}
              value={props.standortId}
              onChange={(e) => props.onStandort(e.currentTarget.value)}
            >
              <For each={props.standorte}>
                {(s) => <option value={s.standortId}>{s.name}</option>}
              </For>
            </select>
          )}
        />
      </Show>
      <Button
        variant="icon"
        aria-label={m.plan_vorige_woche()}
        class="border border-border"
        onClick={() => props.onWoche(-1)}
      >
        <Icon icon={ChevronLeft} class="rtl:rotate-180" />
      </Button>
      <Button
        variant="icon"
        aria-label={m.plan_naechste_woche()}
        class="border border-border"
        onClick={() => props.onWoche(1)}
      >
        <Icon icon={ChevronRight} class="rtl:rotate-180" />
      </Button>
      <Show when={props.planer}>
        <Button variant="outline" onClick={() => props.onVorlagen()}>
          {m.plan_vorlagen()}
        </Button>
        <Button variant="outline" onClick={() => props.onBedarf()}>
          {m.plan_bedarf()}
        </Button>
      </Show>
    </div>
  </header>
);
