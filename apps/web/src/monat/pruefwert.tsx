import { Link } from "@tanstack/solid-router";
import { createUniqueId, Show } from "solid-js";
import { m } from "../paraglide/messages.js";

/**
 * The Prüfwert of a closed month (design/mockup/Monatsabschluss.dc.html): it stands on the person's
 * time sheet, and the check page shows any later change against it
 */
export const Pruefwert = (props: { name: string; pruefwert: string | null; betriebId: string }) => {
  const id = createUniqueId();
  return (
    <section
      aria-labelledby={id}
      class="flex flex-col gap-2 rounded-xl border border-border bg-muted px-4 py-3"
    >
      <h2 id={id} class="font-semibold text-[13px]">
        {m.monat_pruefwert()}
      </h2>
      <p class="text-muted-foreground">{m.monat_pruefwert_text({ name: props.name })}</p>
      <Show
        when={props.pruefwert}
        fallback={<p class="font-mono text-muted-foreground">{m.monat_pruefwert_offen()}</p>}
      >
        {(wert) => (
          <>
            <code data-testid="pruefwert" class="break-all font-mono text-[12px]" dir="ltr">
              {wert()}
            </code>
            <Link
              to="/pruefen"
              search={{ betrieb: props.betriebId }}
              class="self-start font-medium underline underline-offset-2"
            >
              {m.monat_zur_pruefseite()}
            </Link>
          </>
        )}
      </Show>
    </section>
  );
};
