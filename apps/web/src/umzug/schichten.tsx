import type { Zuordnung } from "@soll/import";
import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Abschnitt, Zeile } from "./auswahl.tsx";
import type { Vorschau } from "./typen.ts";

/*
 * The site the planned shifts of a shift planner go to (S-706): one of the business's, or none, and
 * then they are not taken over. Without the module Dienstplan the shifts are refused; the line says
 * so before the dry run does.
 */

const KEINER = "";

export const SchichtZuordnung = (props: {
  vorschau: Vorschau;
  zuordnung: Zuordnung;
  standort: (standortId: string | null) => void;
}) => (
  <Show when={props.vorschau.anzahl.schichten > 0}>
    <Abschnitt titel={m.umzug_schichten_titel()} text={m.umzug_schichten_text()}>
      <Show
        when={props.vorschau.module.dienstplan}
        fallback={
          <p class="rounded-lg bg-warning-surface px-3 py-2.5">{m.umzug_schichten_modul_aus()}</p>
        }
      >
        <Zeile
          name={m.umzug_schichten_standort()}
          hinweis={m.umzug_datensaetze({ anzahl: props.vorschau.anzahl.schichten })}
          wert={props.zuordnung.standort ?? KEINER}
          optionen={[
            { wert: KEINER, name: m.umzug_nicht_uebernehmen() },
            ...props.vorschau.standorte.map((s) => ({ wert: s.standortId, name: s.name })),
          ]}
          aendern={(wert) => props.standort(wert === KEINER ? null : wert)}
        />
      </Show>
    </Abschnitt>
  </Show>
);
