import { Button, Input } from "@soll/ui";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { zuordnungAus } from "./formular.ts";
import { postenText } from "./texte.ts";
import { type DatevAnsicht, PFAD } from "./typen.ts";

const FEHLER: Record<string, () => string> = {
  ungueltig: m.datev_fehler_format,
  doppelt: m.datev_fehler_doppelt,
};

/**
 * The mapping for the DATEV export in the settings (S-308): consultant and client number, a
 * personnel number per person and a wage type per item, chosen with the payroll office. For owner
 * and payroll only: the server answers everyone else with 403, and the section stays away.
 */
export const DatevZuordnung = () => {
  const id = createUniqueId();
  const [ansicht, setAnsicht] = createSignal<DatevAnsicht | null>(null);
  const [fehler, setFehler] = createSignal("");
  const [gespeichert, setGespeichert] = createSignal(false);
  void api<DatevAnsicht>(PFAD).then((antwort) => antwort.ok && setAnsicht(antwort.daten));
  const speichern = async (event: SubmitEvent, a: DatevAnsicht) => {
    event.preventDefault();
    const body = zuordnungAus(new FormData(event.currentTarget as HTMLFormElement), a);
    const antwort = await api<DatevAnsicht>(PFAD, { method: "PUT", body });
    setGespeichert(antwort.ok);
    if (!antwort.ok) return setFehler((FEHLER[antwort.fehler] ?? m.fehler_speichern)());
    setFehler("");
    setAnsicht(antwort.daten);
  };
  return (
    <Show when={ansicht()}>
      {(a) => (
        <section aria-labelledby={`${id}-titel`} class="flex max-w-lg flex-col gap-3">
          <h2 id={`${id}-titel`} class="font-semibold">
            {m.datev_titel()}
          </h2>
          <p class="text-muted-foreground">{m.datev_text()}</p>
          <form class="flex flex-col gap-4" onSubmit={(event) => speichern(event, a())}>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label={m.datev_berater()}
                hinweis={m.datev_berater_hinweis()}
                name="beraterNr"
                inputmode="numeric"
                value={a().beraterNr ?? ""}
              />
              <Input
                label={m.datev_mandant()}
                hinweis={m.datev_mandant_hinweis()}
                name="mandantenNr"
                inputmode="numeric"
                value={a().mandantenNr ?? ""}
              />
            </div>
            <fieldset class="flex flex-col gap-3">
              <legend class="mb-1 font-medium">{m.datev_personen()}</legend>
              <For each={a().personen}>
                {(person) => (
                  <Input
                    label={m.datev_personalnummer({ name: person.name })}
                    name={`pnr-${person.nutzerId}`}
                    inputmode="numeric"
                    value={person.personalnummer ?? ""}
                  />
                )}
              </For>
            </fieldset>
            <fieldset class="flex flex-col gap-3">
              <legend class="mb-1 font-medium">{m.datev_lohnarten()}</legend>
              <p class="text-[12px] text-muted-foreground">{m.datev_lohnart_hinweis()}</p>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <For each={a().postenarten}>
                  {(art) => (
                    <Input
                      label={postenText(art)}
                      name={`lohnart-${art}`}
                      inputmode="numeric"
                      value={a().lohnarten[art] ?? ""}
                    />
                  )}
                </For>
              </div>
            </fieldset>
            <Fehler text={fehler()} />
            <Show when={gespeichert()}>
              <p role="status" class="text-success">
                {m.datev_gespeichert()}
              </p>
            </Show>
            <Button type="submit" variant="outline" class="self-start">
              {m.datev_speichern()}
            </Button>
          </form>
        </section>
      )}
    </Show>
  );
};
