import { Icon } from "@soll/ui";
import { Link } from "@tanstack/solid-router";
import { For } from "solid-js";
import { m } from "../paraglide/messages.js";
import { BEREICHE } from "./bereiche.ts";
import { Darstellung } from "./darstellung.tsx";

/** The sidebar from md on: the app, its areas, colours and language (DESIGN.md, "Aufbau") */
export const Seitenleiste = () => (
  <nav
    aria-label={m.nav_bereiche()}
    class="sticky top-0 hidden h-dvh w-58 shrink-0 flex-col gap-1 border-e border-border bg-muted px-3 py-5 md:flex"
  >
    <div class="flex items-center gap-2.5 px-2 pb-4">
      <span
        aria-hidden="true"
        class="flex size-7 items-center justify-center rounded-[7px] bg-primary font-bold text-primary-foreground"
      >
        {m.start_title().slice(0, 1)}
      </span>
      <span class="font-semibold">{m.start_title()}</span>
    </div>
    <For each={BEREICHE}>
      {(bereich) => (
        <Link
          to={bereich.pfad}
          activeOptions={{ exact: true }}
          class="flex min-h-9 items-center gap-2.5 rounded-sm px-2.5 hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-semibold"
        >
          <Icon icon={bereich.icon} />
          {bereich.name()}
        </Link>
      )}
    </For>
    <div class="mt-auto px-1">
      <Darstellung />
    </div>
  </nav>
);
