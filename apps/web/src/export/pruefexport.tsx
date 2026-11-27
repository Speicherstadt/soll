import type { Tag } from "@soll/arbeitszeit";
import { DatePicker } from "@soll/ui";
import { createSignal, createUniqueId, For, Loading, Show } from "solid-js";
import { abfrage, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { feld, knopfLink } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import type { Person } from "../zeiten/typen.ts";
import { ALLE, pruefexportPfad, startZeitraum, zeitraumGueltig } from "./zeitraum.ts";

const Datum = (props: { id: string; label: string; wert: Tag; onWert: (tag: Tag) => void }) => (
  <div class="flex flex-col gap-1.5">
    <label for={props.id} class="font-medium">
      {props.label}
    </label>
    <DatePicker id={props.id} value={props.wert} onValue={props.onWert} />
  </div>
);

/** Whose days: everyone or one person, for whoever may see all times (the list answers only them) */
const PersonWahl = (props: {
  id: string;
  personen: Person[];
  wahl: string;
  onWahl: (w: string) => void;
}) => (
  <div class="flex min-w-48 flex-col gap-1.5">
    <label for={props.id} class="font-medium">
      {m.zeiten_person()}
    </label>
    <select
      id={props.id}
      class={feld}
      value={props.wahl}
      onChange={(event) => props.onWahl(event.currentTarget.value)}
    >
      <option value={ALLE}>{m.pruefexport_alle()}</option>
      <For each={props.personen}>
        {(person) => <option value={person.nutzerId}>{person.name}</option>}
      </For>
    </select>
  </div>
);

/**
 * The Prüfexport (S-309): a period and the people, then CSV or PDF; a person without the right to
 * see others gets their own days
 */
export const Pruefexport = () => {
  const id = createUniqueId();
  const start = startZeitraum(Date.now());
  const [anfang, setAnfang] = createSignal<Tag>(start.anfang);
  const [ende, setEnde] = createSignal<Tag>(start.ende);
  const personenAbfrage = abfrage<{ personen: Person[] }>(ressourcen.personen);
  const personen = () => daten(personenAbfrage.data)?.personen ?? [];
  const [wahl, setWahl] = createSignal(ALLE);
  const gueltig = () => zeitraumGueltig(anfang(), ende());
  const pfad = (format: "csv" | "pdf") =>
    pruefexportPfad({
      anfang: anfang(),
      ende: ende(),
      format,
      wahl: personen().length > 0 ? wahl() : "",
      personen: personen().map((p) => p.nutzerId),
    });
  return (
    <section class="flex max-w-3xl flex-col gap-3" aria-labelledby={`${id}-titel`}>
      <h2 id={`${id}-titel`} class="font-semibold">
        {m.pruefexport_titel()}
      </h2>
      <p class="text-muted-foreground">{m.pruefexport_text()}</p>
      <div class="flex flex-wrap items-end gap-3">
        <Datum id={`${id}-anfang`} label={m.pruefexport_von()} wert={anfang()} onWert={setAnfang} />
        <Datum id={`${id}-ende`} label={m.pruefexport_bis()} wert={ende()} onWert={setEnde} />
        <Loading>
          <Show when={personen().length > 0}>
            <PersonWahl id={`${id}-person`} personen={personen()} wahl={wahl()} onWahl={setWahl} />
          </Show>
        </Loading>
      </div>
      <Show when={gueltig()} fallback={<p role="alert">{m.pruefexport_fehler_zeitraum()}</p>}>
        <Loading>
          <div class="flex flex-wrap gap-2">
            <a href={pfad("csv")} download class={knopfLink}>
              {m.pruefexport_csv()}
            </a>
            <a href={pfad("pdf")} download class={knopfLink}>
              {m.pruefexport_pdf()}
            </a>
          </div>
        </Loading>
      </Show>
    </section>
  );
};
