import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "./cn.ts";
import { variants } from "./variants.ts";

const knopf = variants({
  base: "inline-flex items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:pointer-events-none disabled:opacity-50",
  variants: {
    variant: {
      primary: "bg-primary text-primary-foreground hover:opacity-90",
      outline: "border border-border bg-background hover:bg-accent",
      ghost: "hover:bg-accent",
      icon: "hover:bg-accent",
    },
    size: { sm: "h-8 px-3 text-[12px]", md: "h-9 px-4", lg: "h-11 px-5 text-[15px]" },
  },
  defaults: { variant: "primary", size: "md" },
});

const iconGroesse = { sm: "size-8", md: "size-9", lg: "size-11" } as const;

type Basis = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "class"> & {
  size?: "sm" | "md" | "lg";
  class?: string;
};

/** An icon button has no text of its own, so it must carry a name (DESIGN.md, "Komponenten") */
export type ButtonProps =
  | (Basis & { variant?: "primary" | "outline" | "ghost" })
  | (Basis & { variant: "icon"; "aria-label": string });

/** One main action per view is `primary`; everything else `outline`, `ghost` or `icon` */
export const Button = (props: ButtonProps) => {
  const rest = omit(props, "variant", "size", "class", "type");
  return (
    <button
      type={props.type ?? "button"}
      class={cn(
        knopf({ variant: props.variant ?? "primary", size: props.size ?? "md" }),
        props.variant === "icon" && cn(iconGroesse[props.size ?? "md"], "px-0"),
        props.class,
      )}
      {...rest}
    />
  );
};
