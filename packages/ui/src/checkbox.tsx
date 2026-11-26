import type { JSX } from "@solidjs/web";
import { Check } from "lucide";
import { omit } from "solid-js";
import { cn } from "./cn.ts";
import { Icon } from "./icon.tsx";

export type CheckboxProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "type" | "class"> & {
  /** Classes applied to the outer <label> wrapper */
  class?: string;
  /** Classes applied to the 16x16 checkbox indicator box */
  boxClass?: string;
  children?: JSX.Element;
};

/**
 * A shadcn/ui-styled checkbox wrapped in its own <label> around a real <input type="checkbox">, so
 * forms, labels, keyboard navigation, Biome's a11y rules, and assistive technologies work natively.
 */
export const Checkbox = (props: CheckboxProps) => {
  const rest = omit(props, "class", "boxClass", "children");
  return (
    <label class={cn("inline-flex cursor-pointer items-center gap-2", props.class)}>
      <span
        class={cn(
          "relative inline-flex size-4 shrink-0 items-center justify-center",
          props.boxClass,
        )}
      >
        <input
          type="checkbox"
          class="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...rest}
        />
        <span
          aria-hidden="true"
          class="pointer-events-none flex size-4 items-center justify-center rounded-[4px] border border-border bg-background text-primary-foreground shadow-2xs transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-foreground peer-focus-visible:outline-offset-2 peer-focus-visible:outline-solid peer-disabled:opacity-50 [&_svg]:opacity-0 peer-checked:[&_svg]:opacity-100"
        >
          <Icon icon={Check} size={12} />
        </span>
      </span>
      {props.children}
    </label>
  );
};
