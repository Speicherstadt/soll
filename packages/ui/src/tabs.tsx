import type { JSX } from "@solidjs/web";
import { createSignal, createUniqueId, For } from "solid-js";
import { istRtl, naechsterIndex } from "./tastatur.ts";

export type Tab = { id: string; label: string; inhalt: () => JSX.Element };

export type TabsProps = {
  label: string;
  tabs: readonly Tab[];
  start?: string | undefined;
  onWechsel?: ((id: string) => void) | undefined;
};

/**
 * Tabs with a roving tab stop: Tab reaches the active tab, arrows (mirrored in right-to-left text),
 * Home and End choose another, the panel follows at once (ARIA Authoring Practices, tabs).
 */
export const Tabs = (props: TabsProps) => {
  const id = createUniqueId();
  const [aktiv, setAktiv] = createSignal<string | undefined>(props.start);
  const gewaehlt = () =>
    props.tabs.some((tab) => tab.id === aktiv()) ? aktiv() : props.tabs[0]?.id;
  let leiste: HTMLDivElement | undefined;
  const aktivieren = (tabId: string) => {
    setAktiv(tabId);
    props.onWechsel?.(tabId);
  };
  const waehlen = (index: number) => {
    const tab = props.tabs[index];
    if (!tab) return;
    aktivieren(tab.id);
    leiste?.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus();
  };
  return (
    <div class="flex min-w-0 flex-col gap-4">
      <div
        role="tablist"
        aria-label={props.label}
        ref={(el) => {
          leiste = el;
        }}
        // wrap tabs onto a second line on narrow screens instead of clipping them
        class="flex w-fit max-w-full flex-wrap gap-1 rounded-lg border border-border bg-muted p-1"
        onKeyDown={(event) => {
          const index = props.tabs.findIndex((tab) => tab.id === gewaehlt());
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
              aria-selected={gewaehlt() === tab.id ? "true" : "false"}
              aria-controls={`${id}-${tab.id}-panel`}
              tabindex={gewaehlt() === tab.id ? "0" : "-1"}
              class={[
                "min-h-11 max-w-full rounded-md px-3 font-medium outline-hidden transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-foreground md:min-h-8 md:shrink-0 md:whitespace-nowrap",
                {
                  "bg-background text-foreground shadow-xs": gewaehlt() === tab.id,
                  "text-muted-foreground hover:text-foreground": gewaehlt() !== tab.id,
                },
              ]}
              onClick={() => aktivieren(tab.id)}
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
            hidden={gewaehlt() !== tab.id}
            tabindex="0"
          >
            {gewaehlt() === tab.id ? tab.inhalt() : null}
          </div>
        )}
      </For>
    </div>
  );
};
