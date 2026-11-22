import { createSignal, createUniqueId, For, Loading } from "solid-js";
import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";

type Modell = { modellId: string; name: string };

/** What a new model changes: the person's model, and the target of their days and months */
const MODELL_AENDERT = [alle(PFAD.personen), alle(PFAD.tag), alle(PFAD.monat)];

/**
 * The working-time model of a person from today on, for the owner (S-304): the target of each day
 * comes from it; without one it is "nicht hinterlegt"
 */
export const ModellWahl = (props: { nutzerId: string; modellId: string | null }) => {
  const id = createUniqueId();
  const [fehler, setFehler] = createSignal("");
  const modelle = abfrage<{ modelle: Modell[] }>(ressourcen.modelle);
  const zuweisen = aenderung(
    (wahl: { nutzerId: string; modellId: string }) =>
      api(`/api/v1/arbeitszeit/personen/${wahl.nutzerId}/modell`, {
        method: "PUT",
        body: { modellId: wahl.modellId },
      }),
    () => MODELL_AENDERT,
  );
  const waehlen = async (modellId: string) => {
    if (!modellId) return;
    const antwort = await zuweisen.mutate({ nutzerId: props.nutzerId, modellId });
    setFehler(antwort.ok ? "" : m.fehler_speichern());
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
        <Loading>
          <For each={daten(modelle.data)?.modelle ?? []}>
            {(modell) => <option value={modell.modellId}>{modell.name}</option>}
          </For>
        </Loading>
      </select>
      <Fehler text={fehler()} />
    </div>
  );
};
