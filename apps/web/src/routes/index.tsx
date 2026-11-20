import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";
import { aktuelleModule } from "../sitzung/sitzung.ts";
import { Stempeln } from "../zeiten/stempeln.tsx";

/** Heute: the stamp button and the running day; without working time there is nothing to stamp */
const Heute = () => (
  <Seite titel={m.nav_heute()}>
    <Show when={aktuelleModule().arbeitszeit} fallback={<Leer text={m.seite_leer()} />}>
      <Stempeln />
    </Show>
  </Seite>
);

export const Route = createFileRoute("/")({ component: Heute });
