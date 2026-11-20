import type { JSX } from "@solidjs/web";
import { createEffect, createUniqueId, Show } from "solid-js";

export type DialogProps = {
  offen: boolean;
  titel: string;
  onSchliessen: () => void;
  children: JSX.Element;
  /** Buttons at the foot, the main action last */
  aktionen?: JSX.Element;
};

/**
 * A modal on the native <dialog> with showModal(): the browser traps focus, closes on Esc and puts
 * focus back (DESIGN.md, "Komponenten"). A click on the backdrop closes it too.
 */
export const Dialog = (props: DialogProps) => {
  const id = createUniqueId();
  let element: HTMLDialogElement | undefined;
  createEffect(
    () => props.offen,
    (offen) => {
      if (!element) return;
      if (offen && !element.open) element.showModal();
      if (!offen && element.open) element.close();
    },
  );
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click is on the backdrop; Esc, its keyboard twin, is the browser's own
    <dialog
      ref={(el) => {
        element = el;
      }}
      aria-labelledby={id}
      onClose={() => props.onSchliessen()}
      onClick={(event) => {
        if (event.target === element) element?.close();
      }}
      class="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <div class="flex flex-col gap-4 p-5">
        <h2 id={id} class="font-semibold text-[15px]">
          {props.titel}
        </h2>
        <div>{props.children}</div>
        <Show when={props.aktionen}>
          <div class="flex justify-end gap-2">{props.aktionen}</div>
        </Show>
      </div>
    </dialog>
  );
};
