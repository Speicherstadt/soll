import type { JSX } from "@solidjs/web";
import { createUniqueId, onSettled } from "solid-js";
import { verankert } from "./popover.tsx";

export type TooltipProps = {
  text: string;
  /** classes of the wrapper, e.g. to let a block fill its cell */
  class?: string;
  children: JSX.Element;
};

/**
 * A short note on hover and on keyboard focus, closed with Esc; the element it belongs to names it
 * through aria-describedby. A manual popover, so it never takes focus.
 */
export const Tooltip = (props: TooltipProps) => {
  const id = createUniqueId();
  const anker = `--tooltip-${id}`;
  let hinweis: HTMLDivElement | undefined;
  let huelle: HTMLSpanElement | undefined;
  // the trigger inside is what a screen reader lands on, so it carries the description; set once
  // the content is in place (a ref runs before its element is attached and owns nothing)
  onSettled(() => {
    huelle?.firstElementChild?.setAttribute("aria-describedby", id);
  });
  const zeigen = () => {
    if (hinweis && !hinweis.matches(":popover-open")) hinweis.showPopover();
  };
  const verbergen = () => {
    if (hinweis?.matches(":popover-open")) hinweis.hidePopover();
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the wrapper only listens for its trigger's hover and focus
    <span
      class={props.class ? `inline-flex ${props.class}` : "inline-flex"}
      style={{ "anchor-name": anker }}
      aria-describedby={id}
      onMouseEnter={zeigen}
      onMouseLeave={verbergen}
      onFocusIn={zeigen}
      onFocusOut={verbergen}
      onKeyDown={(event) => {
        if (event.key === "Escape") verbergen();
      }}
      ref={(el) => {
        huelle = el;
      }}
    >
      {props.children}
      <div
        id={id}
        ref={(el) => {
          hinweis = el;
        }}
        popover="manual"
        role="tooltip"
        style={{ ...verankert(anker), "position-area": "block-start" }}
        class="rounded-sm bg-primary px-2 py-1 text-[12px] text-primary-foreground"
      >
        {props.text}
      </div>
    </span>
  );
};
