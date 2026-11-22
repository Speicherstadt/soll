import { createUniqueId, For } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import type { Projekt, Taetigkeit } from "../projekte/typen.ts";
import { taetigkeitName } from "../projekte/werte.ts";

/**
 * The order and activity of a booking as two selects: the orders and activities in use, and the
 * one a booking already names even when archived since, so a change keeps it
 */
export const Auswahl = (props: {
  projekte: readonly Projekt[];
  taetigkeiten: readonly Taetigkeit[];
  projektId?: string | null | undefined;
  taetigkeitId?: string | undefined;
}) => {
  const id = createUniqueId();
  const projekte = () =>
    props.projekte.filter((p) => p.archiviertAm === null || p.projektId === props.projektId);
  const taetigkeiten = () =>
    props.taetigkeiten.filter(
      (t) => t.archiviertAm === null || t.taetigkeitId === props.taetigkeitId,
    );
  return (
    <>
      <div class="flex flex-col gap-1.5">
        <label for={`${id}-auftrag`} class="font-medium">
          {m.stoppuhr_auftrag()}
        </label>
        <select id={`${id}-auftrag`} name="projekt" class={feld} value={props.projektId ?? ""}>
          <option value="">{m.stoppuhr_ohne_auftrag()}</option>
          <For each={projekte()}>
            {(projekt) => <option value={projekt.projektId}>{projekt.name}</option>}
          </For>
        </select>
      </div>
      <div class="flex flex-col gap-1.5">
        <label for={`${id}-taetigkeit`} class="font-medium">
          {m.stoppuhr_taetigkeit()}
        </label>
        <select
          id={`${id}-taetigkeit`}
          name="taetigkeit"
          class={feld}
          value={props.taetigkeitId ?? taetigkeiten()[0]?.taetigkeitId ?? ""}
        >
          <For each={taetigkeiten()}>
            {(taetigkeit) => (
              <option value={taetigkeit.taetigkeitId}>{taetigkeitName(taetigkeit)}</option>
            )}
          </For>
        </select>
      </div>
    </>
  );
};

/** The order and activity a form names */
export const wahlAus = (daten: FormData) => ({
  projektId: String(daten.get("projekt") ?? "") || null,
  taetigkeitId: String(daten.get("taetigkeit") ?? ""),
});
