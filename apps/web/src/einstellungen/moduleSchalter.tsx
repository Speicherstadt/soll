import { MODULE, type Modul } from "@soll/arbeitszeit";
import { Checkbox } from "@soll/ui";
import { createSignal, For } from "solid-js";
import { api } from "../api.ts";
import { MODUL_NAMEN } from "../einrichtung/namen.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { aktuellerBetrieb, sitzungNeu } from "../sitzung/sitzung.ts";
import { istInhaber } from "../sitzung/ziel.ts";

const MODUL_TEXTE: Record<Modul, () => string> = {
  arbeitszeit: m.modul_arbeitszeit_text,
  dienstplan: m.modul_dienstplan_text,
  projektzeit: m.modul_projektzeit_text,
  terminal: m.modul_terminal_text,
};

/**
 * The modules, switched later as in the setup (S-303); only the owner switches them. The server keeps
 * working time on while there are employees and deletes no data of a module switched off.
 */
export const ModuleSchalter = () => {
  const [fehler, setFehler] = createSignal("");
  const darf = () => {
    const betrieb = aktuellerBetrieb();
    return betrieb !== null && istInhaber(betrieb);
  };
  const schalten = async (modul: Modul, an: boolean, feld: HTMLInputElement) => {
    const antwort = await api("/api/v1/betrieb/module", { method: "PATCH", body: { [modul]: an } });
    if (!antwort.ok) {
      feld.checked = !an;
      return setFehler(
        antwort.fehler === "arbeitszeit_pflicht"
          ? m.fehler_arbeitszeit_pflicht()
          : m.fehler_speichern(),
      );
    }
    setFehler("");
    await sitzungNeu();
  };
  return (
    <section class="flex flex-col gap-3">
      <h2 class="font-semibold">{m.module_titel()}</h2>
      <p class="text-muted-foreground">{darf() ? m.module_text() : m.module_nur_inhaber()}</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <For each={MODULE}>
          {(modul) => (
            <Checkbox
              class="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5"
              boxClass="mt-1"
              checked={aktuellerBetrieb()?.module[modul] ?? false}
              disabled={!darf()}
              onChange={(event) =>
                schalten(modul, event.currentTarget.checked, event.currentTarget)
              }
            >
              <span class="flex flex-col">
                <span class="font-medium">{MODUL_NAMEN[modul]()}</span>
                <span class="text-muted-foreground">{MODUL_TEXTE[modul]()}</span>
              </span>
            </Checkbox>
          )}
        </For>
      </div>
      <Fehler text={fehler()} />
    </section>
  );
};
