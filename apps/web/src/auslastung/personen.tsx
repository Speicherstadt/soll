import { Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { For } from "solid-js";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { prozentText } from "./balken.tsx";
import type { PersonenAntwort } from "./typen.ts";

/** The month per person, for owner and planner while the business has switched it on (S-604) */
export const PersonenTabelle = (props: { personen: PersonenAntwort["personen"] }) => (
  <Table beschriftung={m.auslastung_personen()}>
    <Thead>
      <tr>
        <Th>{m.auslastung_person()}</Th>
        <Th class="text-end">{m.auslastung_anwesend()}</Th>
        <Th class="text-end">{m.auslastung_abrechenbar()}</Th>
        <Th class="hidden text-end md:table-cell">{m.auslastung_intern()}</Th>
        <Th class="hidden text-end md:table-cell">{m.auslastung_ohne_buchung()}</Th>
        <Th class="text-end">{m.auslastung_anteil()}</Th>
      </tr>
    </Thead>
    <Tbody>
      <For each={props.personen}>
        {(person) => (
          <Tr>
            <Td>{person.name || m.auslastung_unbekannt()}</Td>
            <Td class="text-end font-mono">{dauerText(person.anwesendMinuten)}</Td>
            <Td class="text-end font-mono">{dauerText(person.abrechenbarMinuten)}</Td>
            <Td class="hidden text-end font-mono md:table-cell">
              {dauerText(person.internMinuten)}
            </Td>
            <Td class="hidden text-end font-mono md:table-cell">
              {dauerText(person.ohneBuchungMinuten)}
            </Td>
            <Td class="text-end">{prozentText(person.abrechenbarProzent)}</Td>
          </Tr>
        )}
      </For>
    </Tbody>
  </Table>
);
