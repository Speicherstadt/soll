import { type Monat, plusMonate } from "@soll/arbeitszeit";
import { Button, Icon } from "@soll/ui";
import { ChevronLeft, ChevronRight } from "lucide";
import { createUniqueId, For, Show } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import type { Person } from "../zeiten/typen.ts";
import { monatText } from "./text.ts";

/** Whose month and which: the person (for whoever may see others) and the month, back and forth */
export const Auswahl = (props: {
  personen: Person[];
  nutzerId: string | undefined;
  monat: Monat;
  onPerson: (nutzerId: string) => void;
  onMonat: (monat: Monat) => void;
}) => {
  const id = createUniqueId();
  return (
    <div class="flex max-w-3xl flex-wrap items-end gap-3">
      <Show when={props.personen.length > 0}>
        <div class="flex min-w-48 flex-col gap-1.5">
          <label for={`${id}-person`} class="font-medium">
            {m.zeiten_person()}
          </label>
          <select
            id={`${id}-person`}
            class={feld}
            value={props.nutzerId ?? ""}
            onChange={(event) => props.onPerson(event.currentTarget.value)}
          >
            <For each={props.personen}>
              {(person) => <option value={person.nutzerId}>{person.name}</option>}
            </For>
          </select>
        </div>
      </Show>
      <fieldset class="flex flex-col gap-1.5">
        <legend class="mb-1.5 font-medium">{m.monat_monat()}</legend>
        <div class="flex items-center gap-1">
          <Button
            variant="icon"
            aria-label={m.monat_vormonat()}
            onClick={() => props.onMonat(plusMonate(props.monat, -1))}
          >
            <Icon icon={ChevronLeft} class="rtl:rotate-180" />
          </Button>
          <span class="min-w-32 text-center font-medium" aria-live="polite">
            {monatText(props.monat)}
          </span>
          <Button
            variant="icon"
            aria-label={m.monat_folgemonat()}
            onClick={() => props.onMonat(plusMonate(props.monat, 1))}
          >
            <Icon icon={ChevronRight} class="rtl:rotate-180" />
          </Button>
        </div>
      </fieldset>
    </div>
  );
};
