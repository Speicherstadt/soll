import { BESCHEINIGUNG_AB_TAG, BESCHEINIGUNG_GESETZ } from "@soll/arbeitszeit";
import { createSignal, createUniqueId, For, Loading, Show } from "solid-js";
import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import type { Liste } from "../abwesenheiten/typen.ts";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";

/**
 * From which day of a sickness the business wants the certificate: the 4th by law, earlier if it
 * asks (§ 5 Abs. 1 Satz 3 EntgFG); only the owner sets it, shown only while working time is on
 */
export const BescheinigungEinstellung = () => {
  const id = createUniqueId();
  const liste = abfrage<Liste>(ressourcen.abwesenheiten);
  const stand = () => {
    const l = daten(liste.data);
    return l?.rechte.einstellen ? l : null;
  };
  const [fehler, setFehler] = createSignal("");
  const [meldung, setMeldung] = createSignal("");
  // the day shows at the sickness report and in its deadline, both read from the absences
  const speichern = aenderung(
    (wert: number) =>
      api<{ bescheinigungAbTag: number }>(`${PFAD.abwesenheiten}/einstellungen`, {
        method: "PUT",
        body: { bescheinigungAbTag: wert },
      }),
    () => [alle(PFAD.abwesenheiten)],
  );
  const setzen = async (wert: number) => {
    const antwort = await speichern.mutate(wert);
    setFehler(antwort.ok ? "" : m.fehler_speichern());
    setMeldung(antwort.ok ? m.abw_einstellung_gespeichert() : "");
  };
  return (
    <Loading>
      <Show when={stand()}>
        {(s) => (
          <section class="flex max-w-sm flex-col gap-3">
            <h2 class="font-semibold">{m.abw_einstellung_titel()}</h2>
            <p class="text-muted-foreground">{m.abw_einstellung_text()}</p>
            <label for={id} class="font-medium">
              {m.abw_einstellung_label()}
            </label>
            <select
              id={id}
              class={feld}
              onChange={(e) => void setzen(Number(e.currentTarget.value))}
            >
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
    </Loading>
  );
};
