import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";
import { aktuelleModule } from "../sitzung/sitzung.ts";
import { Stempeln } from "../zeiten/stempeln.tsx";

/**
 * Heute: the stamp button and the running day; without working time (a business without employees,
 * S-603) there is nothing to stamp, and the page says where the hours go instead
 */
const Heute = () => (
  <Seite titel={m.nav_heute()}>
    <Show when={aktuelleModule().arbeitszeit} fallback={<Leer text={m.heute_ohne_arbeitszeit()} />}>
      <Stempeln />
    </Show>
  </Seite>
);

export const Route = createFileRoute("/")({ component: Heute });
