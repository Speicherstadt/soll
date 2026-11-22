import { Icon } from "@soll/ui";
import { Eye } from "lucide";
import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { zeitpunktText } from "../zeiten/text.ts";

/**
 * The utilisation per person is on (S-604): every member reads it on every page, with the norm
 * (DESIGN.md, "Kontrolle sichtbar machen"; docs/regeln.md R-30). The server sends the instant to
 * every member while the module Projektzeit is on.
 */
export const AuswertungHinweis = () => (
  <Show when={aktuellerBetrieb()?.auswertungJePersonSeit ?? null}>
    {(seit) => (
      <p class="flex max-w-2xl items-start gap-2 rounded-lg border border-border px-3 py-2">
        <Icon icon={Eye} class="mt-0.5 shrink-0" />
        <span>
          {m.auslastung_hinweis({ seit: zeitpunktText(seit()) })}{" "}
          <span class="text-muted-foreground">· {m.auslastung_norm()}</span>
        </span>
      </p>
    )}
  </Show>
);
