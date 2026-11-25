import { plusTage, tagInBerlin } from "@soll/arbeitszeit";
import { Button } from "@soll/ui";
import { createSignal, createUniqueId, For } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import type { Abruf } from "./typen.ts";

/*
 * The way in over a tool's API (S-705, Kimai): the instance, the token and the period of one fetch.
 * The token lives in this form only while it is typed and is cleared once the fetch is done; Soll
 * keeps it nowhere (docs/plan.md, "API-Zugang eines Werkzeugs").
 */

const Feld = (props: {
  name: string;
  typ: "url" | "password" | "text" | "date";
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
        class={feld}
        autocomplete="off"
        value={props.wert}
        onInput={(event) => props.setzen(event.currentTarget.value)}
        aria-describedby={props.hinweis ? `${id}-hinweis` : undefined}
      />
      {props.hinweis && (
        <span id={`${id}-hinweis`} class="text-[12px] text-muted-foreground">
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
  const [instanz, setInstanz] = createSignal("");
  const [token, setToken] = createSignal("");
  const [benutzer, setBenutzer] = createSignal("");
  const [von, setVon] = createSignal(plusTage(heute, -364));
  const [bis, setBis] = createSignal(heute);
  const senden = async (event: SubmitEvent) => {
    event.preventDefault();
    const abruf = {
      zugang: { instanz: instanz(), token: token(), benutzer: benutzer().trim() || null },
      von: von(),
      bis: bis(),
    };
    if (await props.abrufen(abruf)) setToken("");
  };
  return (
    <form class="flex flex-col gap-4" onSubmit={(event) => void senden(event)}>
      <p class="text-muted-foreground">{m.umzug_abruf_text()}</p>
      <div class="grid gap-4 md:grid-cols-2">
        <Feld
          name={m.umzug_abruf_instanz()}
          typ="url"
          wert={instanz()}
          setzen={setInstanz}
          hinweis={m.umzug_abruf_instanz_hinweis()}
        />
        <Feld
          name={m.umzug_abruf_token()}
          typ="password"
          wert={token()}
          setzen={setToken}
          hinweis={m.umzug_abruf_token_hinweis()}
        />
        <Feld
          name={m.umzug_abruf_benutzer()}
          typ="text"
          wert={benutzer()}
          setzen={setBenutzer}
          hinweis={m.umzug_abruf_benutzer_hinweis()}
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
      <Button
        type="submit"
        class="self-start"
        disabled={props.arbeitet || instanz().trim() === "" || token() === ""}
      >
        {m.umzug_abruf_los()}
      </Button>
    </form>
  );
};
