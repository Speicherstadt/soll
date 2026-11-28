import { cn } from "@soll/ui";
import { For } from "solid-js";

/**
 * Steps as numbered pills, the current one marked for screen readers too (DESIGN.md, "Einrichtung"),
 * for the setup and the move from other tools
 */
export const Schrittfolge = (props: { namen: string[]; aktuell: number; beschriftung: string }) => (
  <ol aria-label={props.beschriftung} class="m-0 flex list-none flex-wrap gap-2 p-0">
    <For each={props.namen}>
      {(name, index) => (
        <li
          aria-current={index() === props.aktuell ? "step" : undefined}
          class={cn(
            "flex items-center gap-2 rounded-full border border-border bg-background py-1.5 ps-1.5 pe-3",
            index() === props.aktuell && "border-foreground font-semibold",
          )}
        >
          <span
            aria-hidden="true"
            class={cn(
              "flex size-5.5 items-center justify-center rounded-full text-[12px]",
              index() === props.aktuell
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-foreground",
            )}
          >
            {index() + 1}
          </span>
          {name}
        </li>
      )}
    </For>
  </ol>
);
