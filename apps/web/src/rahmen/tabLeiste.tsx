import { Icon } from "@soll/ui";
import { Link } from "@tanstack/solid-router";
import { For } from "solid-js";
import { m } from "../paraglide/messages.js";
import { aktuelleModule } from "../sitzung/sitzung.ts";
import { tabsFuer } from "./bereiche.ts";

/** The tab bar below md: targets of at least 44 px, reached by the thumb (DESIGN.md) */
export const TabLeiste = () => {
  const tabs = () => tabsFuer(aktuelleModule());
  return (
    <nav
      aria-label={m.nav_bereiche()}
      class="fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      style={{ "grid-template-columns": `repeat(${tabs().length}, minmax(0, 1fr))` }}
    >
      <For each={tabs()}>
        {(tab) => (
          <Link
            to={tab.pfad}
            activeOptions={{ exact: true }}
            class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[12px] text-muted-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
          >
            <Icon icon={tab.icon} size={22} />
            {tab.name()}
          </Link>
        )}
      </For>
    </nav>
  );
};
