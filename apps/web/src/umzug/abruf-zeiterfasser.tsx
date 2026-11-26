import { plusTage, tagInBerlin } from "@soll/arbeitszeit";
import { Button } from "@soll/ui";
import { createSignal, createUniqueId, For } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Feld } from "./abruf.tsx";
import type { Abruf } from "./typen.ts";

/*
 * API fetch forms for Toggl Track and Clockify (S-707):
 * Toggl takes an API token and reaches up to 89 days back (older times come from the CSV export).
 * Clockify takes an API key and the workspace's region (global, EU, USA, UK, AU).
 * Secrets live in the form only while typed and are cleared once the fetch is done.
 */

const REGIONEN = [
  { id: "global", name: () => m.umzug_region_global() },
  { id: "eu", name: () => m.umzug_region_eu() },
  { id: "usa", name: () => m.umzug_region_usa() },
  { id: "uk", name: () => m.umzug_region_uk() },
  { id: "au", name: () => m.umzug_region_au() },
] as const;

export const TogglAbrufFormular = (props: {
  arbeitet: boolean;
  abrufen: (abruf: Abruf) => Promise<boolean>;
}) => {
  const heute = tagInBerlin(Date.now());
  const [token, setToken] = createSignal("");
  const [von, setVon] = createSignal(plusTage(heute, -89));
  const [bis, setBis] = createSignal(heute);
  const senden = async (event: SubmitEvent) => {
    event.preventDefault();
    if (await props.abrufen({ zugang: { token: token() }, von: von(), bis: bis() })) setToken("");
  };
  return (
    <form class="flex flex-col gap-4" onSubmit={(event) => void senden(event)}>
      <p class="text-muted-foreground">{m.umzug_abruf_toggl_text()}</p>
      <div class="grid gap-4 md:grid-cols-2">
        <Feld
          name={m.umzug_abruf_token()}
          typ="password"
          wert={token()}
          setzen={setToken}
          hinweis={m.umzug_abruf_token_hinweis()}
        />
        <div class="grid grid-cols-2 gap-4">
          <For
            each={[
              { name: m.umzug_abruf_von(), wert: von, setzen: setVon },
              { name: m.umzug_abruf_bis(), wert: bis, setzen: setBis },
            ]}
          >
            {(f) => <Feld name={f.name} typ="date" wert={f.wert()} setzen={f.setzen} />}
          </For>
        </div>
      </div>
      <Button type="submit" class="self-start" disabled={props.arbeitet || token().trim() === ""}>
        {m.umzug_abruf_los()}
      </Button>
    </form>
  );
};

export const ClockifyAbrufFormular = (props: {
  arbeitet: boolean;
  abrufen: (abruf: Abruf) => Promise<boolean>;
}) => {
  const heute = tagInBerlin(Date.now());
  const regionId = createUniqueId();
  const [schluessel, setSchluessel] = createSignal("");
  const [region, setRegion] = createSignal("global");
  const [von, setVon] = createSignal(plusTage(heute, -364));
  const [bis, setBis] = createSignal(heute);
  const senden = async (event: SubmitEvent) => {
    event.preventDefault();
    if (
      await props.abrufen({
        zugang: { schluessel: schluessel(), region: region() },
        von: von(),
        bis: bis(),
      })
    )
      setSchluessel("");
  };
  return (
    <form class="flex flex-col gap-4" onSubmit={(event) => void senden(event)}>
      <p class="text-muted-foreground">{m.umzug_abruf_clockify_text()}</p>
      <div class="grid gap-4 md:grid-cols-2">
        <Feld
          name={m.umzug_abruf_schluessel()}
          typ="password"
          wert={schluessel()}
          setzen={setSchluessel}
          hinweis={m.umzug_abruf_token_hinweis()}
        />
        <div class="flex flex-col gap-1.5">
          <label for={regionId} class="font-medium">
            {m.umzug_abruf_region()}
          </label>
          <select
            id={regionId}
            value={region()}
            onChange={(event) => setRegion(event.currentTarget.value)}
            class="h-11 rounded-md border border-border bg-background px-3 text-foreground"
          >
            <For each={REGIONEN}>{(r) => <option value={r.id}>{r.name()}</option>}</For>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4 md:col-span-2">
          <For
            each={[
              { name: m.umzug_abruf_von(), wert: von, setzen: setVon },
              { name: m.umzug_abruf_bis(), wert: bis, setzen: setBis },
            ]}
          >
            {(f) => <Feld name={f.name} typ="date" wert={f.wert()} setzen={f.setzen} />}
          </For>
        </div>
      </div>
      <Button
        type="submit"
        class="self-start"
        disabled={props.arbeitet || schluessel().trim() === ""}
      >
        {m.umzug_abruf_los()}
      </Button>
    </form>
  );
};
