import { Icon } from "@soll/ui";
import { Link, useLocation } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { aktuelleModule, aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { bereicheFuer } from "./bereiche.ts";
import { Darstellung } from "./darstellung.tsx";
import { aktiverBereich } from "./module.ts";

/** The sidebar from md on: the app and the business, its areas, colours and language (DESIGN.md) */
export const Seitenleiste = () => {
  const ort = useLocation();
  const aktiv = () => aktiverBereich(ort().pathname, aktuelleModule());
  return (
    <nav
      aria-label={m.nav_bereiche()}
      class="sticky top-0 hidden h-dvh w-58 shrink-0 flex-col gap-1 border-e border-border bg-muted px-3 py-5 md:flex"
    >
      <div class="flex items-center gap-2.5 px-2 pb-4">
        <span
          aria-hidden="true"
          class="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-primary font-bold text-primary-foreground"
        >
          {m.start_title().slice(0, 1)}
        </span>
        <span class="flex min-w-0 flex-col">
          <span class="font-semibold" translate="no">
            {m.start_title()}
          </span>
          <Show when={aktuellerBetrieb()}>
            {(betrieb) => (
              <span class="truncate text-[12px] text-muted-foreground">{betrieb().name}</span>
            )}
          </Show>
        </span>
      </div>
      <For each={bereicheFuer(aktuelleModule())}>
        {(bereich) => (
          <Link
            to={bereich.pfad}
            activeOptions={{ exact: true }}
            aria-current={aktiv() === bereich.pfad ? "page" : undefined}
            class="flex min-h-9 items-center gap-2.5 rounded-sm px-2.5 hover:bg-accent focus-visible:outline-2 focus-visible:outline-foreground aria-[current=page]:bg-accent aria-[current=page]:font-semibold"
          >
            <Icon icon={bereich.icon} />
            {bereich.name()}
          </Link>
        )}
      </For>
      <div class="mt-auto border-t border-border pt-3">
        <Darstellung />
        <p class="mt-2.5 px-1 text-[11px] text-muted-foreground tabular-nums">v{__APP_VERSION__}</p>
      </div>
    </nav>
  );
};
