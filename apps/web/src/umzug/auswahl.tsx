import type { JSX } from "@solidjs/web";
import { createUniqueId, For, Show } from "solid-js";
import { feld } from "../einrichtung/stil.ts";

/* The rows of the mapping: a value of the file and what it becomes in Soll (S-701) */

export type Option = { wert: string; name: string };

/** One value of the file with its select; the label names the value */
export const Zeile = (props: {
  name: string;
  hinweis?: string;
  wert: string;
  optionen: Option[];
  aendern: (wert: string) => void;
}) => {
  const id = createUniqueId();
  return (
    <div class="flex flex-col gap-1.5 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] md:items-center md:gap-3">
      <label for={id} class="flex min-w-0 flex-col">
        <span class="truncate font-medium">{props.name}</span>
        <span class="text-[12px] text-muted-foreground">{props.hinweis}</span>
      </label>
      <select
        id={id}
        class={feld}
        value={props.wert}
        onChange={(event) => props.aendern(event.currentTarget.value)}
      >
        <For each={props.optionen} keyed={(option) => option.wert}>
          {(option) => (
            // each option says whether it is the one chosen, so a select keeps its choice when the
            // options are made anew after a new reading of the file
            <option value={option().wert} selected={option().wert === props.wert}>
              {option().name}
            </option>
          )}
        </For>
      </select>
    </div>
  );
};

/** A part of the mapping with its title and an optional line under it */
export const Abschnitt = (props: { titel: string; text?: string; children: JSX.Element }) => {
  const id = createUniqueId();
  return (
    <section aria-labelledby={id} class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h3 id={id} class="font-semibold">
          {props.titel}
        </h3>
        <Show when={props.text}>
          <p class="text-muted-foreground">{props.text}</p>
        </Show>
      </div>
      {props.children}
    </section>
  );
};
