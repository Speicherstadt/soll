import type { Zuordnung } from "@soll/import";
import { For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { taetigkeitName } from "../projekte/werte.ts";
import { Abschnitt, type Option, Zeile } from "./auswahl.tsx";
import type { Vorschau } from "./typen.ts";

/*
 * Step 3 for a spreadsheet (S-702): which order and which activity of Soll each project and
 * activity of the file's times is booked on, or none; "" is the activity of times without one
 */

const NICHT = "";

export type BuchungAendern = {
  buchungProjekt: (wert: string, projektId: string | null) => void;
  buchungTaetigkeit: (wert: string, taetigkeitId: string | null) => void;
};

const projektOptionen = (vorschau: Vorschau): Option[] => [
  { wert: NICHT, name: m.umzug_nicht_uebernehmen() },
  ...vorschau.buchung.buchbareProjekte.map((p) => ({
    wert: p.projektId,
    name: `${p.kunde} · ${p.name}`,
  })),
];

const taetigkeitOptionen = (vorschau: Vorschau): Option[] => [
  { wert: NICHT, name: m.umzug_nicht_uebernehmen() },
  ...vorschau.buchung.buchbareTaetigkeiten.map((t) => ({
    wert: t.taetigkeitId,
    name: taetigkeitName(t),
  })),
];

export const BuchungZuordnung = (props: {
  vorschau: Vorschau;
  zuordnung: Zuordnung;
  aendern: BuchungAendern;
}) => (
  <Show
    when={
      props.vorschau.buchung.projekte.length > 0 || props.vorschau.buchung.taetigkeiten.length > 0
    }
  >
    <Abschnitt titel={m.umzug_buchung_titel()} text={m.umzug_buchung_text()}>
      <For each={props.vorschau.buchung.projekte}>
        {(p) => (
          <Zeile
            name={p.wert}
            hinweis={`${m.umzug_feld_projekt()} · ${m.umzug_datensaetze({ anzahl: p.datensaetze })}`}
            wert={props.zuordnung.buchung?.projekte[p.wert] ?? NICHT}
            optionen={projektOptionen(props.vorschau)}
            aendern={(wert) => props.aendern.buchungProjekt(p.wert, wert === NICHT ? null : wert)}
          />
        )}
      </For>
      <For each={props.vorschau.buchung.taetigkeiten}>
        {(t) => (
          <Zeile
            name={t.wert === "" ? m.umzug_ohne_taetigkeit() : t.wert}
            hinweis={`${m.umzug_feld_taetigkeit()} · ${m.umzug_datensaetze({ anzahl: t.datensaetze })}`}
            wert={props.zuordnung.buchung?.taetigkeiten[t.wert] ?? NICHT}
            optionen={taetigkeitOptionen(props.vorschau)}
            aendern={(wert) =>
              props.aendern.buchungTaetigkeit(t.wert, wert === NICHT ? null : wert)
            }
          />
        )}
      </For>
    </Abschnitt>
  </Show>
);
