import { plusTage, tagInBerlin } from "@soll/arbeitszeit";
import { Button } from "@soll/ui";
import { createSignal, For } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Feld } from "./abruf.tsx";
import type { Abruf } from "./typen.ts";

/*
 * The way in over the API of a shift planner (S-706): Papershift's API token, Planday's app id and
 * token, or the e-mail and password of a Crewmeister account, and the period of one fetch, which may
 * reach into the coming plan. The secret lives in this form only while it is typed and is cleared
 * once the fetch is done; Soll keeps it nowhere (docs/plan.md, "API-Zugang eines Werkzeugs").
 */

type Werkzeug = "papershift" | "planday" | "crewmeister";

/** The fields of each tool: the first is no secret (except Papershift's only one), the last is */
const FELDER: Record<
  Werkzeug,
  { name: () => string; typ: "text" | "email" | "password"; schluessel: string }[]
> = {
  papershift: [{ name: () => m.umzug_abruf_token(), typ: "password", schluessel: "token" }],
  planday: [
    { name: () => m.umzug_abruf_app_id(), typ: "text", schluessel: "appId" },
    { name: () => m.umzug_abruf_token(), typ: "password", schluessel: "token" },
  ],
  crewmeister: [
    { name: () => m.umzug_abruf_email(), typ: "email", schluessel: "email" },
    { name: () => m.umzug_abruf_passwort(), typ: "password", schluessel: "passwort" },
  ],
};

export const SchichtplanerAbrufFormular = (props: {
  werkzeug: Werkzeug;
  arbeitet: boolean;
  abrufen: (abruf: Abruf) => Promise<boolean>;
}) => {
  const heute = tagInBerlin(Date.now());
  const [werte, setWerte] = createSignal<Record<string, string>>({});
  const [von, setVon] = createSignal(plusTage(heute, -364));
  const [bis, setBis] = createSignal(heute);
  const felder = () => FELDER[props.werkzeug];
  const vollstaendig = () => felder().every((f) => (werte()[f.schluessel] ?? "").trim() !== "");
  const senden = async (event: SubmitEvent) => {
    event.preventDefault();
    const zugang = Object.fromEntries(felder().map((f) => [f.schluessel, werte()[f.schluessel]]));
    const abruf = { zugang: zugang as Abruf["zugang"], von: von(), bis: bis() };
    // the secret goes; what names the account stays for a second fetch
    if (await props.abrufen(abruf))
      setWerte((alt) => {
        const bleibt: Record<string, string> = {};
        for (const f of felder())
          if (f.typ !== "password") bleibt[f.schluessel] = alt[f.schluessel] ?? "";
        return bleibt;
      });
  };
  return (
    <form class="flex flex-col gap-4" onSubmit={(event) => void senden(event)}>
      <p class="text-muted-foreground">{m.umzug_abruf_schichtplaner_text()}</p>
      <div class="grid gap-4 md:grid-cols-2">
        <For each={felder()}>
          {(f) => (
            <Feld
              name={f.name()}
              typ={f.typ}
              wert={werte()[f.schluessel] ?? ""}
              setzen={(wert) => setWerte((alt) => ({ ...alt, [f.schluessel]: wert }))}
              {...(f.typ === "password" ? { hinweis: m.umzug_abruf_token_hinweis() } : {})}
            />
          )}
        </For>
        <For
          each={[
            { name: m.umzug_abruf_von(), wert: von, setzen: setVon },
            { name: m.umzug_abruf_bis(), wert: bis, setzen: setBis },
          ]}
        >
          {(f) => <Feld name={f.name} typ="date" wert={f.wert()} setzen={f.setzen} />}
        </For>
      </div>
      <Button type="submit" class="self-start" disabled={props.arbeitet || !vollstaendig()}>
        {m.umzug_abruf_los()}
      </Button>
    </form>
  );
};
