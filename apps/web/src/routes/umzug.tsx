import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { istInhaber } from "../sitzung/ziel.ts";
import { Assistent } from "../umzug/assistent.tsx";
import { ImportListe } from "../umzug/liste.tsx";

/**
 * The move from other tools (S-701), for the owner: the server refuses every other role, the page
 * says so instead of showing steps that would fail
 */
const Umzug = () => {
  const inhaber = () => {
    const betrieb = aktuellerBetrieb();
    return betrieb !== null && istInhaber(betrieb);
  };
  return (
    <Seite titel={m.umzug_titel()}>
      <Show when={inhaber()} fallback={<Leer text={m.seite_leer()} />}>
        <Assistent />
        <ImportListe />
      </Show>
    </Seite>
  );
};

export const Route = createFileRoute("/umzug")({ component: Umzug });
