import type { Stempelart } from "@soll/arbeitszeit";
import { For } from "solid-js";
import { m } from "../paraglide/messages.js";
import { ART_NAMEN, zeitpunktText } from "../zeiten/text.ts";

/** What the server kept of a terminal's offline queue (GET /api/v1/terminal/geraete, S-803) */
export type OfflineStand = {
  luecken: { von: number; bis: number }[];
  abgelehnt: { nummer: number; grund: string; art: string; geraetZeitpunkt: number }[];
};

const GRUENDE: Record<string, () => string> = {
  ausweis_unbekannt: () => m.terminal_grund_ausweis_unbekannt(),
  ausweis_unlesbar: () => m.terminal_grund_ausweis_unlesbar(),
  gesperrt: () => m.terminal_grund_gesperrt(),
  zukunft: () => m.terminal_grund_zukunft(),
  abgeschlossen: () => m.terminal_grund_abgeschlossen(),
};

/**
 * Below a terminal in the owner's list: a gap in the numbers of its offline queue (an entry that
 * never arrived) and every entry the server refused, with its reason, so the owner can ask and add
 * a stamp by hand with a reason (docs/plan.md, "Warteschlange am Terminal")
 */
export const TerminalOffline = (props: { stand: OfflineStand | undefined }) => (
  <>
    <For each={props.stand?.luecken ?? []}>
      {(luecke) => (
        <span class="text-danger">
          {m.terminal_offline_luecke({ first: luecke.von, last: luecke.bis })}
        </span>
      )}
    </For>
    <For each={props.stand?.abgelehnt ?? []}>
      {(eintrag) => (
        <span class="text-danger">
          {m.terminal_offline_abgelehnt({
            art: (ART_NAMEN[eintrag.art as Stempelart] ?? (() => eintrag.art))(),
            uhrzeit: zeitpunktText(eintrag.geraetZeitpunkt),
            nummer: eintrag.nummer,
            grund: (GRUENDE[eintrag.grund] ?? (() => eintrag.grund))(),
          })}
        </span>
      )}
    </For>
  </>
);
