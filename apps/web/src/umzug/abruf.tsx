import { tagInBerlin } from "@soll/arbeitszeit";
import { Button } from "@soll/ui";
import { createSignal, createUniqueId, For } from "solid-js";
import { m } from "../paraglide/messages.js";
import type { Abruf } from "./typen.ts";

/*
 * The way in over a tool's API (S-703): the access and the period of one fetch. The key lives in
 * this form only while it is typed and is cleared once the fetch is done; Soll keeps it nowhere
 * (docs/plan.md, "API-Zugang eines Werkzeugs").
 */

const FELD = "h-9 rounded-md border border-border bg-background px-2";

const Feld = (props: {
  name: string;
  typ: "email" | "password" | "date";
  wert: string;
  setzen: (wert: string) => void;
  hinweis?: string;
}) => {
  const id = createUniqueId();
  return (
    <div class="flex flex-col gap-1.5">
      <label for={id} class="font-medium">
        {props.name}
      </label>
      <input
        id={id}
        type={props.typ}
        class={FELD}
        autocomplete="off"
        value={props.wert}
        onInput={(event) => props.setzen(event.currentTarget.value)}
        aria-describedby={props.hinweis ? `${id}-hinweis` : undefined}
      />
      {props.hinweis && (
        <span id={`${id}-hinweis`} class="text-muted-foreground">
          {props.hinweis}
        </span>
      )}
    </div>
  );
};

export const AbrufFormular = (props: {
  arbeitet: boolean;
  abrufen: (abruf: Abruf) => Promise<boolean>;
}) => {
  const heute = tagInBerlin(Date.now());
  const [nutzer, setNutzer] = createSignal("");
  const [schluessel, setSchluessel] = createSignal("");
  const [von, setVon] = createSignal(`${heute.slice(0, 4)}-01-01`);
  const [bis, setBis] = createSignal(heute);
  const senden = async (event: SubmitEvent) => {
    event.preventDefault();
    const abruf = {
      zugang: { nutzer: nutzer(), schluessel: schluessel() },
      von: von(),
      bis: bis(),
    };
    if (await props.abrufen(abruf)) setSchluessel("");
  };
  return (
    <form class="flex flex-col gap-4" onSubmit={(event) => void senden(event)}>
      <p class="text-muted-foreground">{m.umzug_abruf_text()}</p>
      <div class="grid gap-4 md:grid-cols-2">
        <Feld name={m.umzug_abruf_nutzer()} typ="email" wert={nutzer()} setzen={setNutzer} />
        <Feld
          name={m.umzug_abruf_schluessel()}
          typ="password"
          wert={schluessel()}
          setzen={setSchluessel}
          hinweis={m.umzug_abruf_schluessel_hinweis()}
        />
        <For
          each={[
            { name: m.umzug_abruf_von(), wert: von, setzen: setVon },
            { name: m.umzug_abruf_bis(), wert: bis, setzen: setBis },
          ]}
        >
          {(feld) => <Feld name={feld.name} typ="date" wert={feld.wert()} setzen={feld.setzen} />}
        </For>
      </div>
      <Button
        type="submit"
        class="self-start"
        disabled={props.arbeitet || nutzer() === "" || schluessel() === ""}
      >
        {m.umzug_abruf_los()}
      </Button>
    </form>
  );
};
