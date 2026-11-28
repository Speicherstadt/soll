import { createMemo, createSignal, createUniqueId, For, Show } from "solid-js";
import { verankert } from "./popover.tsx";
import { naechsterIndex } from "./tastatur.ts";

export type Option = { wert: string; label: string };

export type ComboboxProps = {
  label: string;
  optionen: readonly Option[];
  /** Shown when the text matches no option */
  leer: string;
  onWaehlen: (wert: string) => void;
};

/**
 * A field that filters a list as you type: role combobox with aria-activedescendant, so focus stays
 * in the field while the arrows move through the list; Enter chooses, Esc closes (ARIA Authoring
 * Practices, combobox with list autocomplete).
 */
export const Combobox = (props: ComboboxProps) => {
  const id = createUniqueId();
  const anker = `--combobox-${id}`;
  const [text, setText] = createSignal("");
  const [offen, setOffen] = createSignal(false);
  const [markiert, setMarkiert] = createSignal(-1);
  let liste: HTMLDivElement | undefined;
  const treffer = createMemo(() =>
    props.optionen.filter((option) =>
      option.label.toLocaleLowerCase().includes(text().toLocaleLowerCase()),
    ),
  );
  const oeffnen = (auf: boolean) => {
    setOffen(auf);
    if (auf && !liste?.matches(":popover-open")) liste?.showPopover();
    if (!auf && liste?.matches(":popover-open")) liste.hidePopover();
    if (!auf) setMarkiert(-1);
  };
  const waehlen = (option: Option) => {
    setText(option.label);
    oeffnen(false);
    props.onWaehlen(option.wert);
  };
  return (
    <div class="flex flex-col gap-1.5">
      <label for={id} class="font-medium">
        {props.label}
      </label>
      <input
        id={id}
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        aria-expanded={offen() ? "true" : "false"}
        aria-controls={`${id}-liste`}
        aria-activedescendant={markiert() >= 0 ? `${id}-option-${markiert()}` : undefined}
        value={text()}
        style={{ "anchor-name": anker }}
        class="h-9 rounded-md border border-control-border bg-background px-3 outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-foreground"
        onInput={(event) => {
          setText(event.currentTarget.value);
          setMarkiert(-1);
          oeffnen(true);
        }}
        onBlur={() => oeffnen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (offen()) oeffnen(false);
            else setText("");
            return;
          }
          if (event.key === "Enter") {
            const option = treffer()[markiert()];
            if (offen() && option) {
              event.preventDefault();
              waehlen(option);
            }
            return;
          }
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          if (!offen()) oeffnen(true);
          const ziel = naechsterIndex(event.key, markiert(), treffer().length, "vertikal");
          if (ziel !== undefined) setMarkiert(ziel);
        }}
      />
      <div
        ref={(el) => {
          liste = el;
        }}
        popover="manual"
        style={{ ...verankert(anker), "min-width": "anchor-size(width)" }}
        class="max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-1 text-foreground shadow-lg"
      >
        {/* a listbox may own options only, so the note for no match sits next to it (axe aria-required-children) */}
        <div id={`${id}-liste`} role="listbox" aria-label={props.label}>
          <For each={treffer()}>
            {(option, index) => (
              // biome-ignore lint/a11y/useFocusableInteractive: focus stays in the field, aria-activedescendant points here (ARIA combobox pattern)
              // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard choice runs via Enter on the combobox input (ARIA combobox pattern)
              <div
                id={`${id}-option-${index()}`}
                role="option"
                aria-selected={markiert() === index() ? "true" : "false"}
                class={[
                  "flex min-h-11 items-center rounded-sm px-2 md:min-h-8",
                  { "bg-accent": markiert() === index() },
                ]}
                onMouseDown={(event) => {
                  // keep focus in the field on mouse and touch taps so blur does not close the list before click
                  if (event.button === 0) event.preventDefault();
                }}
                onClick={() => waehlen(option)}
              >
                {option.label}
              </div>
            )}
          </For>
        </div>
        <Show when={treffer().length === 0}>
          <p class="px-2 py-1.5 text-muted-foreground">{props.leer}</p>
        </Show>
      </div>
    </div>
  );
};
