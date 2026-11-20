import { createSignal, createUniqueId, For } from "solid-js";
import { Button } from "./button.tsx";
import { type Ausloeser, verankert } from "./popover.tsx";
import { naechsterIndex } from "./tastatur.ts";

export type MenuEintrag = { label: string; onWaehlen: () => void; gefaehrlich?: boolean };

export type MenuProps = Ausloeser & { eintraege: readonly MenuEintrag[] };

/**
 * A menu on the Popover API: opens on its button, focus goes to the first entry, arrows, Home and End
 * move, Enter chooses, Esc closes and puts focus back on the button (ARIA Authoring Practices, menu
 * button).
 */
export const Menu = (props: MenuProps) => {
  const id = createUniqueId();
  const anker = `--menu-${id}`;
  const [offen, setOffen] = createSignal(false);
  let knopf: HTMLButtonElement | undefined;
  let liste: HTMLDivElement | undefined;
  const eintraegeIm = () => [...(liste?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  const schliessen = () => {
    liste?.hidePopover();
    knopf?.focus();
  };
  return (
    <>
      <Button
        {...(props.variant === "icon"
          ? { variant: "icon" as const, "aria-label": props["aria-label"] }
          : { variant: props.variant ?? "outline", "aria-label": props["aria-label"] })}
        ref={(el: HTMLButtonElement) => {
          knopf = el;
        }}
        popovertarget={id}
        aria-haspopup="menu"
        aria-expanded={offen() ? "true" : "false"}
        aria-controls={id}
        style={{ "anchor-name": anker }}
      >
        {props.ausloeser}
      </Button>
      <div
        id={id}
        ref={(el) => {
          liste = el;
        }}
        popover="auto"
        role="menu"
        style={verankert(anker)}
        class="min-w-44 rounded-lg border border-border bg-background p-1 text-foreground shadow-lg"
        onToggle={(event) => {
          const auf = (event as ToggleEvent).newState === "open";
          setOffen(auf);
          if (auf) eintraegeIm()[0]?.focus();
        }}
        onKeyDown={(event) => {
          const eintraege = eintraegeIm();
          const index = eintraege.indexOf(document.activeElement as HTMLElement);
          const ziel = naechsterIndex(event.key, index, eintraege.length, "vertikal");
          if (ziel !== undefined) {
            event.preventDefault();
            eintraege[ziel]?.focus();
          } else if (event.key === "Escape") {
            event.preventDefault();
            schliessen();
          } else if (event.key === "Tab") {
            liste?.hidePopover();
          }
        }}
      >
        <For each={props.eintraege}>
          {(eintrag) => (
            <button
              type="button"
              role="menuitem"
              tabindex="-1"
              class={[
                "flex h-8 w-full items-center rounded-sm px-2 text-start outline-none hover:bg-accent focus-visible:bg-accent",
                { "text-danger": eintrag.gefaehrlich === true },
              ]}
              onClick={() => {
                schliessen();
                eintrag.onWaehlen();
              }}
            >
              {eintrag.label}
            </button>
          )}
        </For>
      </div>
    </>
  );
};
