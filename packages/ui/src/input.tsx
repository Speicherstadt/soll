import type { JSX } from "@solidjs/web";
import { createUniqueId, omit, Show } from "solid-js";
import { cn } from "./cn.ts";

export type InputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "class" | "id"> & {
  label: string;
  hinweis?: string;
  fehler?: string;
  class?: string;
};

/** A field with its label, a hint and an error, linked for screen readers */
export const Input = (props: InputProps) => {
  const id = createUniqueId();
  const rest = omit(props, "label", "hinweis", "fehler", "class");
  const beschreibung = () =>
    [props.hinweis && `${id}-hinweis`, props.fehler && `${id}-fehler`].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div class={cn("flex flex-col gap-1.5", props.class)}>
      <label for={id} class="font-medium">
        {props.label}
      </label>
      <input
        id={id}
        aria-describedby={beschreibung()}
        aria-invalid={props.fehler ? "true" : undefined}
        class={cn(
          "h-9 rounded-md border border-border bg-background px-3 outline-none focus-visible:outline-2 focus-visible:outline-foreground",
          props.fehler && "border-danger",
        )}
        {...rest}
      />
      <Show when={props.hinweis}>
        <p id={`${id}-hinweis`} class="text-[12px] text-muted-foreground">
          {props.hinweis}
        </p>
      </Show>
      <Show when={props.fehler}>
        <p id={`${id}-fehler`} class="text-[12px] text-danger">
          {props.fehler}
        </p>
      </Show>
    </div>
  );
};
