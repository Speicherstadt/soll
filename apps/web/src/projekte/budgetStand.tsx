import type { BudgetZeile } from "@soll/arbeitszeit";
import { Badge } from "@soll/ui";
import { For, Show } from "solid-js";
import { dauerText, euroText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";

const betrag = (zeile: BudgetZeile, wert: number) =>
  zeile.art === "minuten" ? dauerText(Math.max(0, wert)) : euroText(Math.max(0, wert), getLocale());

/**
 * What the bookings used of an order's budget (S-602): used of budget per line, and the warning or
 * "aufgebraucht" in words, never by color alone (DESIGN.md, "Farben")
 */
export const BudgetVerbrauch = (props: { zeilen: BudgetZeile[] }) => (
  <For each={props.zeilen}>
    {(zeile) => (
      <span class="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
        {m.budget_verbraucht({
          verbraucht: betrag(zeile, zeile.verbraucht),
          budget: betrag(zeile, zeile.budget),
        })}
        <Show when={zeile.stufe === "warnung"}>
          <Badge ton="warning">{m.budget_stufe_warnung()}</Badge>
        </Show>
        <Show when={zeile.stufe === "aufgebraucht"}>
          <Badge ton="danger">{m.budget_stufe_aufgebraucht()}</Badge>
        </Show>
      </span>
    )}
  </For>
);
