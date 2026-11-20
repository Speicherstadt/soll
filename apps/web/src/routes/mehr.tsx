import { Icon } from "@soll/ui";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { For } from "solid-js";
import { m } from "../paraglide/messages.js";
import { mehrFuer } from "../rahmen/bereiche.ts";
import { Darstellung } from "../rahmen/darstellung.tsx";
import { Seite } from "../rahmen/seite.tsx";
import { aktuelleModule } from "../sitzung/sitzung.ts";

/** On phones: the areas the tab bar leaves out, then colours and language */
const Mehr = () => (
  <Seite titel={m.nav_mehr()}>
    <ul class="flex flex-col divide-y divide-border rounded-lg border border-border">
      <For each={mehrFuer(aktuelleModule())}>
        {(bereich) => (
          <li>
            <Link to={bereich.pfad} class="flex min-h-12 items-center gap-3 px-4">
              <Icon icon={bereich.icon} size={20} />
              {bereich.name()}
            </Link>
          </li>
        )}
      </For>
    </ul>
    <section class="flex flex-col gap-3">
      <h2 class="font-semibold">{m.darstellung_titel()}</h2>
      <Darstellung />
    </section>
  </Seite>
);

export const Route = createFileRoute("/mehr")({ component: Mehr });
