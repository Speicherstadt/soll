import type { JSX } from "@solidjs/web";
import { TimePicker } from "@soll/ui";
import { createUniqueId, For, Show } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { minuteAus } from "../zeiten/aktionen.ts";
import { minutenText } from "./text.ts";

/** A labelled field of a plan form; the control gets the id through `kind` */
export const Feld = (props: {
  label: string;
  hinweis?: string;
  class?: string;
  kind: (id: string, hinweisId: string | undefined) => JSX.Element;
}) => {
  const id = createUniqueId();
  return (
    <div class={`flex flex-col gap-1.5 ${props.class ?? ""}`}>
      <label for={id} class="font-medium">
        {props.label}
      </label>
      {props.kind(id, props.hinweis ? `${id}-hinweis` : undefined)}
      {props.hinweis && (
        <p id={`${id}-hinweis`} class="text-[12px] text-muted-foreground">
          {props.hinweis}
        </p>
      )}
    </div>
  );
};

/** A time on the Berlin clock, as minutes after midnight */
export const ZeitFeld = (props: {
  label: string;
  minute: number;
  onMinute: (minute: number) => void;
}) => (
  <Feld
    label={props.label}
    kind={(id) => (
      <TimePicker
        id={id}
        required
        value={minutenText(props.minute)}
        onValue={(wert) => {
          const minute = minuteAus(wert);
          if (minute !== null) props.onMinute(minute);
        }}
      />
    )}
  />
);

/** A whole number within limits: minutes of a break, people of a need (no fractions, CLAUDE.md) */
export const ZahlFeld = (props: {
  label: string;
  wert: number;
  min: number;
  max: number;
  onWert: (wert: number) => void;
}) => (
  <Feld
    label={props.label}
    kind={(id) => (
      <input
        id={id}
        type="number"
        inputmode="numeric"
        min={props.min}
        max={props.max}
        step="1"
        class={feld}
        value={props.wert}
        onChange={(event) => {
          const zahl = Math.trunc(Number(event.currentTarget.value) || props.min);
          props.onWert(Math.min(props.max, Math.max(props.min, zahl)));
        }}
      />
    )}
  />
);

/** A text field such as a name or a role, with the roles already in use to choose from */
export const TextFeld = (props: {
  label: string;
  wert: string;
  vorschlaege?: readonly string[];
  onWert: (wert: string) => void;
}) => (
  <Feld
    label={props.label}
    kind={(id) => (
      <>
        <input
          id={id}
          class={feld}
          maxlength={60}
          list={props.vorschlaege ? `${id}-liste` : undefined}
          value={props.wert}
          onInput={(event) => props.onWert(event.currentTarget.value)}
        />
        <Show when={props.vorschlaege}>
          {(liste) => (
            <datalist id={`${id}-liste`}>
              <For each={liste()}>{(eintrag) => <option value={eintrag} />}</For>
            </datalist>
          )}
        </Show>
      </>
    )}
  />
);
