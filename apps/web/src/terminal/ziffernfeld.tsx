import { For } from "solid-js";
import { m } from "../paraglide/messages.js";
import type { Taste } from "./eingabe.ts";

type Feld = { taste: Taste; zeichen: string; name: () => string };

const ziffer = (z: string): Feld => ({
  taste: { art: "ziffer", ziffer: z },
  zeichen: z,
  name: () => m.kiosk_ziffer({ ziffer: z }),
});

const FELDER: Feld[] = [
  ..."123456789".split("").map(ziffer),
  { taste: { art: "loeschen" }, zeichen: "⌫", name: () => m.kiosk_loeschen() },
  ziffer("0"),
  { taste: { art: "ok" }, zeichen: "OK", name: () => m.kiosk_ok() },
];

/**
 * The number pad (DESIGN.md, "Ziffernfeld"): 3 × 4 buttons of 96 px, OK as the one main action;
 * the keyboard works too (eingabe.ts, `tasteAus`). Digits stay left to right in Arabic as well.
 */
export const Ziffernfeld = (props: { onTaste: (taste: Taste) => void; aus: boolean }) => (
  <div dir="ltr" class="grid w-full max-w-[432px] grid-cols-3 gap-4">
    <For each={FELDER}>
      {(feld) => (
        <button
          type="button"
          aria-label={feld.name()}
          disabled={props.aus}
          onClick={() => props.onTaste(feld.taste)}
          class={`h-24 rounded-2xl border border-border font-medium font-mono text-[34px] focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-offset-2 disabled:opacity-50 ${
            feld.taste.art === "ok"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-foreground active:bg-accent"
          }`}
        >
          {feld.zeichen}
        </button>
      )}
    </For>
  </div>
);
