import { Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { For, Loading, Show } from "solid-js";
import { abfrage, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { m } from "../paraglide/messages.js";
import { zeitpunktKurz } from "./texte.ts";
import { ARTEN, type ImportEintrag } from "./typen.ts";

/** What an import created, all kinds together */
const neuAngelegt = (eintrag: ImportEintrag): number =>
  ARTEN.reduce((summe, art) => summe + eintrag.zahlen[art].neu, 0);

/** The imports taken over, newest first, each with its original file to download (S-701) */
export const ImportListe = () => {
  const abgefragt = abfrage<{ importe: ImportEintrag[] }>(ressourcen.importe);
  const importe = () => daten(abgefragt.data)?.importe ?? [];
  return (
    <section aria-labelledby="importe-titel" class="flex flex-col gap-3">
      <h2 id="importe-titel" class="font-semibold">
        {m.umzug_liste_titel()}
      </h2>
      <Loading>
        <Show
          when={importe().length > 0}
          fallback={<p class="text-muted-foreground">{m.umzug_liste_leer()}</p>}
        >
          <Table beschriftung={m.umzug_liste_titel()}>
            <Thead>
              <Tr>
                <Th>{m.umzug_liste_am()}</Th>
                <Th>{m.umzug_liste_werkzeug()}</Th>
                <Th>{m.umzug_liste_datei()}</Th>
                <Th class="hidden md:table-cell">{m.umzug_liste_von()}</Th>
                <Th>{m.umzug_liste_neu()}</Th>
              </Tr>
            </Thead>
            <Tbody>
              <For each={importe()}>
                {(eintrag) => (
                  <Tr>
                    <Td>{zeitpunktKurz(eintrag.am)}</Td>
                    <Td>{eintrag.quelleName}</Td>
                    <Td>
                      <a
                        href={`/api/v1/importe/${encodeURIComponent(eintrag.importId)}/datei`}
                        download={eintrag.dateiName}
                        aria-label={m.umzug_datei_laden({ name: eintrag.dateiName })}
                        class="underline underline-offset-2"
                      >
                        {eintrag.dateiName}
                      </a>
                    </Td>
                    <Td class="hidden md:table-cell">{eintrag.von}</Td>
                    <Td>{neuAngelegt(eintrag)}</Td>
                  </Tr>
                )}
              </For>
            </Tbody>
          </Table>
        </Show>
      </Loading>
    </section>
  );
};
