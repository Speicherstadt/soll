import { plusTage, tagInBerlin } from "@soll/arbeitszeit";
import { Button } from "@soll/ui";
import { createSignal, For } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Feld } from "./abruf.tsx";
import type { Abruf } from "./typen.ts";

/*
 * The way in over Personio's API v2 (S-704): the client ID and secret of a custom integration and
 * the period of one fetch, like Kimai's form (abruf-kimai.tsx, S-705); Personio's address is fixed.
 * The secret lives in this form only while it is typed and is cleared once the fetch is done; Soll
 * keeps it nowhere (docs/plan.md, "API-Zugang eines Werkzeugs").
 */

export const PersonioAbrufFormular = (props: {
  arbeitet: boolean;
  abrufen: (abruf: Abruf) => Promise<boolean>;
}) => {
  const heute = tagInBerlin(Date.now());
  const [clientId, setClientId] = createSignal("");
  const [clientSecret, setClientSecret] = createSignal("");
  const [von, setVon] = createSignal(plusTage(heute, -364));
  const [bis, setBis] = createSignal(heute);
  const senden = async (event: SubmitEvent) => {
    event.preventDefault();
    const abruf = {
      zugang: { clientId: clientId(), clientSecret: clientSecret() },
      von: von(),
      bis: bis(),
    };
    if (await props.abrufen(abruf)) setClientSecret("");
  };
  return (
    <form class="flex flex-col gap-4" onSubmit={(event) => void senden(event)}>
      <p class="text-muted-foreground">{m.umzug_abruf_personio_text()}</p>
      <div class="grid gap-4 md:grid-cols-2">
        <Feld name={m.umzug_abruf_client_id()} typ="text" wert={clientId()} setzen={setClientId} />
        <Feld
          name={m.umzug_abruf_client_secret()}
          typ="password"
          wert={clientSecret()}
          setzen={setClientSecret}
          hinweis={m.umzug_abruf_token_hinweis()}
        />
        <For
          each={[
            { name: m.umzug_abruf_von(), wert: von, setzen: setVon },
            { name: m.umzug_abruf_bis(), wert: bis, setzen: setBis },
          ]}
        >
          {(f) => <Feld name={f.name} typ="date" wert={f.wert()} setzen={f.setzen} />}
        </For>
      </div>
      <Button
        type="submit"
        class="self-start"
        disabled={props.arbeitet || clientId().trim() === "" || clientSecret() === ""}
      >
        {m.umzug_abruf_los()}
      </Button>
    </form>
  );
};
