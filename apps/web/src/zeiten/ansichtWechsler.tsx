import { Link } from "@tanstack/solid-router";
import { knopfLink } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";

const AKTIV =
  "inline-flex min-h-11 items-center rounded-md bg-background px-3.5 font-medium text-foreground shadow-xs md:min-h-8";
const INAKTIV =
  "inline-flex min-h-11 items-center rounded-md px-3.5 font-medium text-muted-foreground transition-colors hover:text-foreground md:min-h-8";

/**
 * Shared view switcher between daily times (/zeiten) and monthly closing (/monat), so switching
 * back and forth is always one click from the same place.
 */
export const ZeitenWechsler = (props: { aktiv: "tag" | "monat" }) => (
  <div class="flex flex-wrap items-center justify-between gap-3">
    <nav
      aria-label={m.nav_zeiten()}
      class="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-lg border border-border bg-muted p-1"
    >
      <Link
        to="/zeiten"
        aria-current={props.aktiv === "tag" ? "page" : undefined}
        class={props.aktiv === "tag" ? AKTIV : INAKTIV}
      >
        {m.nav_zeiten()}
      </Link>
      <Link
        to="/monat"
        aria-current={props.aktiv === "monat" ? "page" : undefined}
        class={props.aktiv === "monat" ? AKTIV : INAKTIV}
      >
        {m.monat_titel()}
      </Link>
    </nav>
    <Link to="/export" class={knopfLink}>
      {m.pruefexport_titel()}
    </Link>
  </div>
);
