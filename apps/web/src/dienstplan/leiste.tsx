import { For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { minutenSpanne } from "./text.ts";
import type { Vorlage } from "./typen.ts";
import { VORLAGE_TYP } from "./ziehen.ts";

/**
 * The templates to drag onto a day at the desktop; with the keyboard a shift is added from a
 * template in the dialog behind the "+" of a cell
 */
export const VorlagenLeiste = (props: { vorlagen: readonly Vorlage[] }) => (
  <Show when={props.vorlagen.length > 0}>
    <section
      aria-labelledby="vorlagen-leiste"
      class="flex flex-wrap items-center gap-2 max-md:hidden"
    >
      <h2 id="vorlagen-leiste" class="font-medium text-muted-foreground">
        {m.plan_vorlagen_hinweis()}
      </h2>
      <ul class="m-0 flex list-none flex-wrap gap-2 p-0">
        <For each={props.vorlagen}>
          {(vorlage) => (
            <li
              draggable="true"
              data-vorlage={vorlage.vorlageId}
              class="flex cursor-grab items-baseline gap-2 rounded-sm border border-border bg-background px-2.5 py-1"
              onDragStart={(event) => {
                event.dataTransfer?.setData(VORLAGE_TYP, vorlage.vorlageId);
                if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
              }}
            >
              <span class="font-medium">{vorlage.name}</span>
              <span class="font-mono text-[12px] text-muted-foreground" dir="ltr">
                {minutenSpanne(vorlage.beginnMinute, vorlage.endeMinute)}
              </span>
            </li>
          )}
        </For>
      </ul>
    </section>
  </Show>
);
