import type { JSX } from "@solidjs/web";
import { createUniqueId } from "solid-js";
import { Button, type ButtonProps } from "./button.tsx";

export type PopoverProps = {
  /** The content of the button that opens it */
  ausloeser: JSX.Element;
  variant?: ButtonProps["variant"];
  "aria-label"?: string;
  children: JSX.Element;
};

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
  return (
    <>
      <Button
        variant={props.variant === "icon" ? "outline" : (props.variant ?? "outline")}
        popovertarget={id}
        aria-label={props["aria-label"]}
        style={{ "anchor-name": anker }}
      >
        {props.ausloeser}
      </Button>
      <div
        id={id}
        popover="auto"
        style={verankert(anker)}
        class="min-w-48 rounded-lg border border-border bg-background p-3 text-foreground shadow-lg"
      >
        {props.children}
      </div>
    </>
  );
};
