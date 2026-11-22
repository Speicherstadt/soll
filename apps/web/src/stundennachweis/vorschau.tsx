import { Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { For, Show } from "solid-js";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { datumText } from "../projekte/werte.ts";
import { uhrzeitText } from "../zeiten/text.ts";
import type { Vorschau } from "./typen.ts";

/** The bookings the customer signs: day, person, time, minutes, activity and note, with the sum */
export const VorschauTabelle = (props: { vorschau: Vorschau }) => (
  <Show
    when={props.vorschau.zeilen.length > 0}
    fallback={<p class="text-muted-foreground">{m.nachweis_leer()}</p>}
  >
    <Table beschriftung={m.nachweis_vorschau()}>
      <Thead>
        <Tr>
          <Th>{m.nachweis_spalte_tag()}</Th>
          <Th>{m.nachweis_spalte_zeit()}</Th>
          <Th>{m.nachweis_spalte_taetigkeit()}</Th>
          <Th class="text-end">{m.nachweis_spalte_dauer()}</Th>
        </Tr>
      </Thead>
      <Tbody>
        <For each={props.vorschau.zeilen}>
          {(zeile) => (
            <Tr>
              <Td class="py-1.5">
                <span class="block">{datumText(zeile.tag)}</span>
                <span class="block text-[12px] text-muted-foreground">{zeile.person}</span>
              </Td>
              <Td class="py-1.5 tabular-nums">
                {`${uhrzeitText(zeile.beginn)}–${uhrzeitText(zeile.ende)}`}
              </Td>
              <Td class="py-1.5">
                <span class="block">{zeile.taetigkeit}</span>
                <Show when={zeile.notiz}>
                  <span class="block text-[12px] text-muted-foreground">{zeile.notiz}</span>
                </Show>
              </Td>
              <Td class="py-1.5 text-end tabular-nums">{dauerText(zeile.minuten)}</Td>
            </Tr>
          )}
        </For>
      </Tbody>
    </Table>
    <p class="font-semibold">
      {m.nachweis_summe({ dauer: dauerText(props.vorschau.summeMinuten) })}
    </p>
  </Show>
);
