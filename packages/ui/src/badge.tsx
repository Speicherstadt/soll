import type { JSX } from "@solidjs/web";
import { variants } from "./variants.ts";

const marke = variants({
  base: "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[12px] font-medium",
  variants: {
    ton: {
      neutral: "bg-accent text-foreground",
      success: "text-success",
      warning: "bg-warning-surface text-warning",
      danger: "text-danger",
    },
  },
  defaults: { ton: "neutral" },
});

export type BadgeProps = {
  ton?: "neutral" | "success" | "warning" | "danger";
  children: JSX.Element;
};

/** A short state; the color is never the only sign, the text says it too (DESIGN.md, "Farben") */
export const Badge = (props: BadgeProps) => (
  <span class={marke({ ton: props.ton ?? "neutral" })}>{props.children}</span>
);
