import { Checkbox } from "@soll/ui";
import { useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, Loading, Show } from "solid-js";
import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { alle, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { istInhaber } from "../sitzung/ziel.ts";
import { GeraetSchalter } from "./geraet.tsx";
import { PFAD } from "./push.ts";
import { RegelnFormular } from "./regeln.tsx";
import type { ErinnerungAnsicht, Wuensche } from "./typen.ts";

const ARTEN: { art: keyof Wuensche; name: () => string; text: () => string }[] = [
  { art: "ausstempeln", name: m.erinnerungen_ausstempeln, text: m.erinnerungen_ausstempeln_text },
  { art: "pause", name: m.erinnerungen_pause, text: m.erinnerungen_pause_text },
  { art: "monat", name: m.erinnerungen_monat, text: m.erinnerungen_monat_text },
  { art: "mail", name: m.erinnerungen_mail, text: m.erinnerungen_mail_text },
];

/** What a change to the reminders changes: the reminders as loaded */
const ERINNERUNGEN_AENDERT = [alle(PFAD)];

/**
 * Reminders in the settings (S-307): this device on or off, which reminders the person wants, and
 * for the owner the times of the business. Only for who stamps in a business with working time:
 * the server answers everyone else with 403, and the section stays away.
 */
export const Erinnerungen = () => {
  const client = useQueryClient();
  const abfrageErinnerungen = abfrage<ErinnerungAnsicht>(ressourcen.erinnerungen);
  const ansicht = () => daten(abfrageErinnerungen.data);
  const [fehler, setFehler] = createSignal("");
  const speichern = aenderung(
    (wuensche: Wuensche) => api(`${PFAD}/wuensche`, { method: "PUT", body: wuensche }),
    () => ERINNERUNGEN_AENDERT,
  );
  const setzen = async (art: keyof Wuensche, an: boolean, feld: HTMLInputElement) => {
    const vorher = ansicht();
    if (!vorher) return;
    const antwort = await speichern.mutate({ ...vorher.wuensche, [art]: an });
    if (!antwort.ok) {
      feld.checked = !an;
      return setFehler(m.fehler_speichern());
    }
    setFehler("");
  };
  const neuLaden = () => void client.invalidateQueries({ queryKey: alle(PFAD) });
  const inhaber = () => {
    const betrieb = aktuellerBetrieb();
    return betrieb !== null && istInhaber(betrieb);
  };
  return (
    <Loading>
      <Show when={ansicht()}>
        {(a) => (
          <section class="flex flex-col gap-4">
            <div class="flex flex-col gap-1">
              <h2 class="font-semibold">{m.erinnerungen_titel()}</h2>
              <p class="text-muted-foreground">{m.erinnerungen_text()}</p>
            </div>
            <GeraetSchalter vapidSchluessel={a().vapidSchluessel} onGeaendert={neuLaden} />
            <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <For each={ARTEN}>
                {(eintrag) => (
                  <Checkbox
                    class="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5"
                    boxClass="mt-1"
                    checked={a().wuensche[eintrag.art]}
                    disabled={eintrag.art === "mail" && !a().mail}
                    onChange={(event) =>
                      setzen(eintrag.art, event.currentTarget.checked, event.currentTarget)
                    }
                  >
                    <span class="flex flex-col">
                      <span class="font-medium">{eintrag.name()}</span>
                      <span class="text-[12px] text-muted-foreground">
                        {eintrag.art === "mail" && !a().mail
                          ? m.erinnerungen_mail_keine()
                          : eintrag.text()}
                      </span>
                    </span>
                  </Checkbox>
                )}
              </For>
            </div>
            <Fehler text={fehler()} />
            <Show when={inhaber()}>
              <RegelnFormular regeln={a().regeln} />
            </Show>
          </section>
        )}
      </Show>
    </Loading>
  );
};
