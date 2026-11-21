import type { JSX } from "@solidjs/web";
import { createUniqueId, For, Show } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import type { Person, Projekt } from "../projekte/typen.ts";

export type WahlFelder = { projektId: string; von: string; bis: string; nutzerId: string };

/** A labelled native field in a column of the choice */
const Feld = (props: { id: string; label: string; children: JSX.Element }) => (
  <div class="flex flex-col gap-1.5 md:w-48">
    <label for={props.id} class="font-medium">
      {props.label}
    </label>
    {props.children}
  </div>
);

/**
 * What the report is about: the order, the span of working days and (for whoever keeps the orders)
 * one person or everyone; each change asks for the preview again
 */
export const NachweisWahlFelder = (props: {
  werte: WahlFelder;
  projekte: Projekt[];
  personen: Person[];
  verwalten: boolean;
  onAendern: (werte: Partial<WahlFelder>) => void;
}) => {
  const id = createUniqueId();
  return (
    <div class="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
      <Feld id={`${id}-auftrag`} label={m.nachweis_auftrag()}>
        <select
          id={`${id}-auftrag`}
          class={feld}
          value={props.werte.projektId}
          onChange={(event) => props.onAendern({ projektId: event.currentTarget.value })}
        >
          <For each={props.projekte}>
            {(projekt) => <option value={projekt.projektId}>{projekt.name}</option>}
          </For>
        </select>
      </Feld>
      <Feld id={`${id}-start`} label={m.nachweis_von()}>
        <input
          id={`${id}-start`}
          type="date"
          class={feld}
          value={props.werte.von}
          onChange={(event) => props.onAendern({ von: event.currentTarget.value })}
        />
      </Feld>
      <Feld id={`${id}-ende`} label={m.nachweis_bis()}>
        <input
          id={`${id}-ende`}
          type="date"
          class={feld}
          value={props.werte.bis}
          onChange={(event) => props.onAendern({ bis: event.currentTarget.value })}
        />
      </Feld>
      <Show when={props.verwalten}>
        <Feld id={`${id}-person`} label={m.nachweis_person()}>
          <select
            id={`${id}-person`}
            class={feld}
            value={props.werte.nutzerId}
            onChange={(event) => props.onAendern({ nutzerId: event.currentTarget.value })}
          >
            <option value="">{m.nachweis_alle()}</option>
            <For each={props.personen}>
              {(person) => <option value={person.nutzerId}>{person.name}</option>}
            </For>
          </select>
        </Feld>
      </Show>
    </div>
  );
};
