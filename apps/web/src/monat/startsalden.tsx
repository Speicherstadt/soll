import { createUniqueId, For, Show } from "solid-js";
import { tageText, tagText } from "../abwesenheiten/text.ts";
import { m } from "../paraglide/messages.js";
import type { Startsaldo } from "./typen.ts";
import { saldoText } from "./zeilen.ts";

/**
 * The start balances on the first day of the month (S-708): part of the month's content, so the
 * person confirms them with the month and the Prüfwert covers them
 */
export const Startsalden = (props: { monat: string; salden: Startsaldo[] | undefined }) => {
  const id = createUniqueId();
  return (
    <Show when={(props.salden ?? []).length > 0}>
      <section aria-labelledby={id} class="flex flex-col gap-1.5">
        <h2 id={id} class="font-semibold text-[13px] text-muted-foreground">
          {m.monat_startsaldo_titel({ datum: tagText(`${props.monat}-01`, true) })}
        </h2>
        <ul class="flex flex-col gap-1">
          <For each={props.salden ?? []}>
            {(saldo) => (
              <li>
                {saldo.art === "ueberstunden"
                  ? m.monat_startsaldo_ueberstunden({
                      wert: saldoText(saldo.minuten),
                      grund: saldo.grund,
                    })
                  : m.monat_startsaldo_urlaub({
                      wert: tageText(saldo.halbtage),
                      grund: saldo.grund,
                    })}
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
};
