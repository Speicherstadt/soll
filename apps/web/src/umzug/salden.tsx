import { Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { For, Show } from "solid-js";
import { tageText } from "../abwesenheiten/text.ts";
import { saldoText } from "../monat/zeilen.ts";
import { m } from "../paraglide/messages.js";
import { tagKurz } from "./texte.ts";
import type { Liste, Saldo } from "./typen.ts";

/**
 * The balances on a cut-off date in the file (S-708), for the owner to compare with the old tool
 * before the takeover: per person the day, the overtime and the leave left
 */
export const SaldenVorschau = (props: { salden: Liste<Saldo> }) => (
  <Show when={props.salden.anzahl > 0}>
    <section aria-labelledby="salden-titel" class="flex flex-col gap-2">
      <h3 id="salden-titel" class="font-semibold">
        {m.umzug_salden_titel()}
      </h3>
      <p class="text-muted-foreground">{m.umzug_salden_text()}</p>
      <Table beschriftung={m.umzug_salden_titel()}>
        <Thead>
          <Tr>
            <Th>{m.umzug_feld_person()}</Th>
            <Th>{m.umzug_salden_stichtag()}</Th>
            <Th>{m.umzug_feld_ueberstunden()}</Th>
            <Th>{m.umzug_feld_resturlaub()}</Th>
          </Tr>
        </Thead>
        <Tbody>
          <For each={props.salden.liste}>
            {(saldo) => (
              <Tr>
                <Td>{saldo.person}</Td>
                <Td>{tagKurz(saldo.stichtag)}</Td>
                <Td>
                  {saldo.ueberstundenMinuten === null ? "–" : saldoText(saldo.ueberstundenMinuten)}
                </Td>
                <Td>{saldo.urlaubHalbtage === null ? "–" : tageText(saldo.urlaubHalbtage)}</Td>
              </Tr>
            )}
          </For>
        </Tbody>
      </Table>
    </section>
  </Show>
);
