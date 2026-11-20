import { createSignal, createUniqueId, For } from "solid-js";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";

type Modell = { modellId: string; name: string };

/**
 * The working-time model of a person from today on, for the owner (S-304): the target of each day
 * comes from it; without one it is "nicht hinterlegt"
 */
export const ModellWahl = (props: {
  nutzerId: string;
  modellId: string | null;
  onGespeichert: (modellId: string) => void;
}) => {
  const id = createUniqueId();
  const [modelle, setModelle] = createSignal<Modell[]>([]);
  const [fehler, setFehler] = createSignal("");
  api<{ modelle: Modell[] }>("/api/v1/arbeitszeit/modelle").then(
    (antwort) => antwort.ok && setModelle(antwort.daten.modelle),
  );
  const waehlen = async (modellId: string) => {
    if (!modellId) return;
    const antwort = await api(`/api/v1/arbeitszeit/personen/${props.nutzerId}/modell`, {
      method: "PUT",
      body: { modellId },
    });
    if (!antwort.ok) return setFehler(m.fehler_speichern());
    setFehler("");
    props.onGespeichert(modellId);
  };
  return (
    <div class="flex min-w-48 flex-col gap-1.5">
      <label for={`${id}-modell`} class="font-medium">
        {m.zeiten_modell()}
      </label>
      <select
        id={`${id}-modell`}
        class={feld}
        value={props.modellId ?? ""}
        onChange={(event) => waehlen(event.currentTarget.value)}
      >
        <option value="" disabled>
          {m.zeiten_modell_keins()}
        </option>
        <For each={modelle()}>
          {(modell) => <option value={modell.modellId}>{modell.name}</option>}
        </For>
      </select>
      <Fehler text={fehler()} />
    </div>
  );
};
