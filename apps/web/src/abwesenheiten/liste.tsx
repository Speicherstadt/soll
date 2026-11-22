import { Button } from "@soll/ui";
import { For, Show } from "solid-js";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Karte, StatusMarke } from "./karte.tsx";
import { type AbwesenheitQuelle, BASIS } from "./quelle.ts";
import { ART, tageText, zeitraumText } from "./text.ts";
import type { Abwesenheit } from "./typen.ts";

const Zeile = (props: { a: Abwesenheit; quelle: AbwesenheitQuelle }) => (
  <li class="flex flex-wrap items-center justify-between gap-2 border-border border-t py-2 first:border-t-0">
    <div class="flex flex-col">
      <span class="font-medium">
        {ART[props.a.art]()} · {zeitraumText(props.a)}
        <Show when={props.a.urlaubHalbtage}>{(halbtage) => <> · {tageText(halbtage())}</>}</Show>
      </span>
      <Show when={props.a.grund}>
        {(grund) => (
          <span class="text-[12px] text-muted-foreground">
            {m.abw_grund_zeile({ grund: grund() })}
          </span>
        )}
      </Show>
    </div>
    <div class="flex items-center gap-2">
      <StatusMarke status={props.a.status} />
      <Show when={props.a.status === "beantragt"}>
        <Button
          variant="outline"
          onClick={() =>
            void props.quelle.senden(() =>
              api(`${BASIS}/${props.a.abwesenheitId}/zurueckziehen`, { body: {} }),
            )
          }
        >
          {m.abw_zurueckziehen()}
        </Button>
      </Show>
    </div>
  </li>
);

/** „Meine Abwesenheiten“: the requests and absences of the year with their state */
export const MeineListe = (props: { quelle: AbwesenheitQuelle; abwesenheiten: Abwesenheit[] }) => (
  <Karte titel={m.abw_meine_titel()}>
    <Show
      when={props.abwesenheiten.length > 0}
      fallback={<p class="text-muted-foreground">{m.abw_keine()}</p>}
    >
      <ul class="flex flex-col">
        <For each={[...props.abwesenheiten].reverse()}>
          {(a) => <Zeile a={a} quelle={props.quelle} />}
        </For>
      </ul>
    </Show>
  </Karte>
);
