import type { JSX } from "@solidjs/web";
import { createSignal, createUniqueId, For } from "solid-js";
import { istRtl, naechsterIndex } from "./tastatur.ts";

export type Tab = { id: string; label: string; inhalt: () => JSX.Element };

export type TabsProps = { label: string; tabs: readonly Tab[]; start?: string };

/**
 * Tabs with a roving tab stop: Tab reaches the active tab, arrows (mirrored in right-to-left text),
 * Home and End choose another, the panel follows at once (ARIA Authoring Practices, tabs).
 */
export const Tabs = (props: TabsProps) => {
  const id = createUniqueId();
  const [aktiv, setAktiv] = createSignal(() => props.start ?? props.tabs[0]?.id);
  let leiste: HTMLDivElement | undefined;
  const waehlen = (index: number) => {
    const tab = props.tabs[index];
    if (!tab) return;
    setAktiv(tab.id);
    leiste?.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus();
  };
  return (
    <div class="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label={props.label}
        ref={(el) => {
          leiste = el;
        }}
        // a phone scrolls the tabs sideways when they are wider than the screen
        class="inline-flex w-fit max-w-full gap-1 overflow-x-auto rounded-md bg-muted p-1"
        onKeyDown={(event) => {
          const index = props.tabs.findIndex((tab) => tab.id === aktiv());
          const ziel = naechsterIndex(
            event.key,
            index,
            props.tabs.length,
            "horizontal",
            istRtl(event.currentTarget),
          );
          if (ziel === undefined) return;
          event.preventDefault();
          waehlen(ziel);
        }}
      >
        <For each={props.tabs}>
          {(tab) => (
            <button
              type="button"
              role="tab"
              id={`${id}-${tab.id}-tab`}
              aria-selected={aktiv() === tab.id ? "true" : "false"}
              aria-controls={`${id}-${tab.id}-panel`}
              tabindex={aktiv() === tab.id ? "0" : "-1"}
              class={[
                "h-7 shrink-0 whitespace-nowrap rounded-sm px-3 font-medium outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-foreground",
                {
                  "bg-background shadow-sm": aktiv() === tab.id,
                  "text-muted-foreground": aktiv() !== tab.id,
                },
              ]}
              onClick={() => setAktiv(tab.id)}
            >
              {tab.label}
            </button>
          )}
        </For>
      </div>
      <For each={props.tabs}>
        {(tab) => (
          <div
            role="tabpanel"
            id={`${id}-${tab.id}-panel`}
            aria-labelledby={`${id}-${tab.id}-tab`}
            hidden={aktiv() !== tab.id}
            tabindex="0"
          >
            {aktiv() === tab.id ? tab.inhalt() : null}
          </div>
        )}
      </For>
    </div>
  );
};
