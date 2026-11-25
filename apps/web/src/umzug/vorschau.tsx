import { Badge } from "@soll/ui";
import { For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { tagKurz } from "./texte.ts";
import type { Vorschau } from "./typen.ts";

/**
 * Step 4: the findings of the rules on the file's times, per person of the file, with their norm
 * (DESIGN.md, "Befund mit Norm"): what happened in the old tool is shown, not changed
 */
export const VorschauSchritt = (props: { vorschau: Vorschau }) => (
  <div class="flex flex-col gap-3">
    <p class="text-muted-foreground">{m.umzug_befunde_text()}</p>
    <Show
      when={props.vorschau.befunde.anzahl > 0}
      fallback={<p role="status">{m.umzug_befunde_keine()}</p>}
    >
      <ul
        aria-label={m.umzug_befunde_titel()}
        class="flex flex-col divide-y divide-border rounded-lg border border-border"
      >
        <For each={props.vorschau.befunde.liste}>
          {(befund) => (
            <li class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <Badge ton={befund.schwere === "verstoss" ? "danger" : "warning"}>
                {befund.schwere === "verstoss" ? m.befund_verstoss() : m.befund_hinweis()}
              </Badge>
              <span class="font-medium">{befund.person}</span>
              <span>{befund.tage.map(tagKurz).join(", ")}</span>
              <span class="text-muted-foreground">
                {befund.regel} · {befund.norm}
              </span>
            </li>
          )}
        </For>
      </ul>
      <Show when={props.vorschau.befunde.anzahl > props.vorschau.befunde.liste.length}>
        <p class="text-muted-foreground">
          {m.umzug_befunde_mehr({
            anzahl: props.vorschau.befunde.anzahl - props.vorschau.befunde.liste.length,
          })}
        </p>
      </Show>
    </Show>
  </div>
);
