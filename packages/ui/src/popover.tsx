import type { JSX } from "@solidjs/web";
import { createSignal, createUniqueId } from "solid-js";
import { Button } from "./button.tsx";

/**
 * The button that opens a floating element: with text, or an icon that must carry a name, as for
 * Button (DESIGN.md, "Komponenten")
 */
export type Ausloeser =
  | { ausloeser: JSX.Element; variant?: "outline" | "ghost"; "aria-label"?: string }
  | { ausloeser: JSX.Element; variant: "icon"; "aria-label": string };

export type PopoverProps = Ausloeser & { children: JSX.Element };

/** Where a floating element sits below its anchor; logical, so it mirrors in right-to-left text */
export const verankert = (anker: string): JSX.CSSProperties => ({
  "position-anchor": anker,
  "position-area": "block-end span-inline-end",
  "position-try-fallbacks": "flip-block, flip-inline",
  margin: "4px 0",
});

/**
 * Content that floats next to a button, on the Popover API with CSS anchor positioning: the browser
 * opens it with Enter or Space, closes it on Esc or a click outside, no script of our own.
 */
export const Popover = (props: PopoverProps) => {
  const id = createUniqueId();
  const anker = `--popover-${id}`;
  const [offen, setOffen] = createSignal(false);
  return (
    <>
      <Button
        {...(props.variant === "icon"
          ? { variant: "icon" as const, "aria-label": props["aria-label"] }
          : { variant: props.variant ?? "outline", "aria-label": props["aria-label"] })}
        popovertarget={id}
        aria-expanded={offen() ? "true" : "false"}
        aria-controls={id}
        style={{ "anchor-name": anker }}
      >
        {props.ausloeser}
      </Button>
      <div
        id={id}
        popover="auto"
        style={verankert(anker)}
        class="min-w-48 overscroll-contain rounded-lg border border-border bg-background p-3 text-foreground shadow-lg"
        onToggle={(event) => {
          setOffen((event as ToggleEvent).newState === "open");
        }}
      >
        {props.children}
      </div>
    </>
  );
};
