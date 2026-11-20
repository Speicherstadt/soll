import type { JSX } from "@solidjs/web";
import { createUniqueId } from "solid-js";
import { verankert } from "./popover.tsx";

export type TooltipProps = { text: string; children: JSX.Element };

/**
 * A short note on hover and on keyboard focus, closed with Esc; the element it belongs to names it
 * through aria-describedby. A manual popover, so it never takes focus.
 */
export const Tooltip = (props: TooltipProps) => {
  const id = createUniqueId();
  const anker = `--tooltip-${id}`;
  let hinweis: HTMLDivElement | undefined;
  const zeigen = () => {
    if (hinweis && !hinweis.matches(":popover-open")) hinweis.showPopover();
  };
  const verbergen = () => {
    if (hinweis?.matches(":popover-open")) hinweis.hidePopover();
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the wrapper only listens for its trigger's hover and focus
    <span
      class="inline-flex"
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
        // the trigger inside is what a screen reader lands on, so it carries the description
        queueMicrotask(() => el.firstElementChild?.setAttribute("aria-describedby", id));
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
