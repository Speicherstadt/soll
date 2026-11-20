import { Badge, Button, Icon } from "@soll/ui";
import { Pencil, Trash2 } from "lucide";
import { For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { ART_NAMEN, aenderungText, uhrzeitText, zeitpunktText } from "./text.ts";
import type { Aenderung, Stempel } from "./typen.ts";

/**
 * The stamps of a day, each with Ändern and Entfernen for whoever may correct it, and a mark when a
 * person entered or changed it by hand, when it came from a device's offline queue, and when it still
 * waits on this device (then there is nothing on the server to correct yet; S-305)
 */
export const StempelListe = (props: {
  stempelungen: Stempel[];
  darfKorrigieren: boolean;
  onAendern: (stempel: Stempel) => void;
  onEntfernen: (stempel: Stempel) => void;
}) => (
  <section aria-labelledby="stempelungen-titel" class="flex flex-col gap-2">
    <h2 id="stempelungen-titel" class="font-semibold text-[13px] text-muted-foreground">
      {m.stempelungen_titel()}
    </h2>
    <Show
      when={props.stempelungen.length > 0}
      fallback={<p class="text-muted-foreground">{m.stempelungen_keine()}</p>}
    >
      <ul
        aria-labelledby="stempelungen-titel"
        class="flex flex-col divide-y divide-border rounded-lg border border-border"
      >
        <For each={props.stempelungen}>
          {(stempel) => {
            const name = () => ({
              art: ART_NAMEN[stempel.art](),
              uhrzeit: uhrzeitText(stempel.zeitpunkt),
            });
            return (
              <li class="flex min-h-11 items-center justify-between gap-3 px-3 py-1.5">
                <span class="flex items-center gap-2">
                  <span class="font-mono tabular-nums">{name().uhrzeit}</span>
                  <span>{name().art}</span>
                  <Show when={stempel.korrigiert}>
                    <Badge>{m.stempel_korrigiert()}</Badge>
                  </Show>
                  <Show
                    when={stempel.wartend}
                    fallback={
                      <Show when={stempel.offline}>
                        <Badge>{m.stempel_offline()}</Badge>
                      </Show>
                    }
                  >
                    <Badge ton="warning">{m.stempel_wartet()}</Badge>
                  </Show>
                </span>
                <Show when={props.darfKorrigieren && !stempel.wartend}>
                  <span class="flex gap-1">
                    <Button
                      variant="icon"
                      size="lg"
                      aria-label={m.stempel_aendern(name())}
                      onClick={() => props.onAendern(stempel)}
                    >
                      <Icon icon={Pencil} />
                    </Button>
                    <Button
                      variant="icon"
                      size="lg"
                      aria-label={m.stempel_entfernen(name())}
                      onClick={() => props.onEntfernen(stempel)}
                    >
                      <Icon icon={Trash2} />
                    </Button>
                  </span>
                </Show>
              </li>
            );
          }}
        </For>
      </ul>
    </Show>
  </section>
);

/** Every change to the times of the day: who changed what, when and why (DESIGN.md, "Kontrolle sichtbar machen") */
export const AenderungListe = (props: { aenderungen: Aenderung[] }) => (
  <Show when={props.aenderungen.length > 0}>
    <section aria-labelledby="aenderungen-titel" class="flex flex-col gap-2">
      <h2 id="aenderungen-titel" class="font-semibold text-[13px] text-muted-foreground">
        {m.aenderungen_titel()}
      </h2>
      <ul aria-labelledby="aenderungen-titel" class="flex flex-col gap-2">
        <For each={props.aenderungen}>
          {(aenderung) => (
            <li class="flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2">
              <span>{aenderungText(aenderung)}</span>
              <span class="text-[12px] text-muted-foreground">
                {`${zeitpunktText(aenderung.am)} · ${m.aenderung_grund({ grund: aenderung.grund })}`}
              </span>
            </li>
          )}
        </For>
      </ul>
    </section>
  </Show>
);
