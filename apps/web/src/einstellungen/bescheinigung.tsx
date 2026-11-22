import { BESCHEINIGUNG_AB_TAG, BESCHEINIGUNG_GESETZ } from "@soll/arbeitszeit";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import type { Liste } from "../abwesenheiten/typen.ts";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";

const BASIS = "/api/v1/arbeitszeit/abwesenheiten";

/**
 * From which day of a sickness the business wants the certificate: the 4th by law, earlier if it
 * asks (§ 5 Abs. 1 Satz 3 EntgFG); only the owner sets it, shown only while working time is on
 */
export const BescheinigungEinstellung = () => {
  const id = createUniqueId();
  const [stand, setStand] = createSignal<Pick<Liste, "bescheinigungAbTag" | "rechte"> | null>(null);
  const [fehler, setFehler] = createSignal("");
  const [meldung, setMeldung] = createSignal("");
  api<Liste>(BASIS).then((antwort) => antwort.ok && setStand(antwort.daten));
  const setzen = async (wert: number) => {
    const antwort = await api<{ bescheinigungAbTag: number }>(`${BASIS}/einstellungen`, {
      method: "PUT",
      body: { bescheinigungAbTag: wert },
    });
    setFehler(antwort.ok ? "" : m.fehler_speichern());
    setMeldung(antwort.ok ? m.abw_einstellung_gespeichert() : "");
  };
  return (
    <Show when={stand()?.rechte.einstellen ? stand() : null}>
      {(s) => (
        <section class="flex max-w-sm flex-col gap-3">
          <h2 class="font-semibold">{m.abw_einstellung_titel()}</h2>
          <p class="text-muted-foreground">{m.abw_einstellung_text()}</p>
          <label for={id} class="font-medium">
            {m.abw_einstellung_label()}
          </label>
          <select id={id} class={feld} onChange={(e) => void setzen(Number(e.currentTarget.value))}>
            <For each={BESCHEINIGUNG_AB_TAG}>
              {(tag) => (
                <option value={tag} selected={tag === s().bescheinigungAbTag}>
                  {tag === BESCHEINIGUNG_GESETZ
                    ? m.abw_einstellung_gesetz()
                    : m.abw_einstellung_tag({ tag: String(tag) })}
                </option>
              )}
            </For>
          </select>
          <Show when={meldung()}>
            <p role="status">{meldung()}</p>
          </Show>
          <Fehler text={fehler()} />
        </section>
      )}
    </Show>
  );
};
