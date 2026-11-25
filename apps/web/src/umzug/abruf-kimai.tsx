import { plusTage, tagInBerlin } from "@soll/arbeitszeit";
import { Button } from "@soll/ui";
import { createSignal, For } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Feld } from "./abruf.tsx";
import type { Abruf } from "./typen.ts";

/*
 * The way in over Kimai's API (S-705): the instance, the token and the period of one fetch, like
 * Clockodo's form (abruf.tsx, S-703).
 * The token lives in this form only while it is typed and is cleared once the fetch is done; Soll
 * keeps it nowhere (docs/plan.md, "API-Zugang eines Werkzeugs").
 */

export const KimaiAbrufFormular = (props: {
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
      <p class="text-muted-foreground">{m.umzug_abruf_kimai_text()}</p>
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
