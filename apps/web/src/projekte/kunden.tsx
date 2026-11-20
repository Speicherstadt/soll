import { Input, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { createSignal, For } from "solid-js";
import { m } from "../paraglide/messages.js";
import { type ProjektQuelle, zeilenAktionen } from "./quelle.ts";
import { Aktionen, LeerText, NeuFormular, Stand } from "./teile.tsx";

/** The customers of the business, for owner and planner (S-601) */
export const Kunden = (props: { quelle: ProjektQuelle }) => {
  const [fehler, setFehler] = createSignal("");
  const [arbeitet, setArbeitet] = createSignal(false);
  const aktionen = zeilenAktionen("kunden", props.quelle, setFehler);
  const anlegen = async (daten: FormData, form: HTMLFormElement) => {
    setArbeitet(true);
    const nummer = String(daten.get("nummer")).trim();
    const ok = await aktionen.anlegen({
      name: String(daten.get("name")).trim(),
      ...(nummer ? { nummer } : {}),
    });
    setArbeitet(false);
    if (ok) form.reset();
  };
  return (
    <div class="flex flex-col gap-4">
      <NeuFormular
        label={m.kunde_anlegen()}
        knopf={m.kunde_anlegen()}
        fehler={fehler()}
        arbeitet={arbeitet()}
        onSubmit={anlegen}
      >
        <Input label={m.kunde_name()} name="name" required maxlength={100} class="md:w-64" />
        <Input label={m.kunde_nummer()} name="nummer" maxlength={40} class="md:w-40" />
      </NeuFormular>
      <LeerText leer={props.quelle.kunden().length === 0} text={m.kunden_leer()} />
      <Table beschriftung={m.kunden_liste()}>
        <Thead>
          <Tr>
            <Th>{m.kunde_name()}</Th>
            <Th>{m.kunde_nummer()}</Th>
            <Th>
              <span class="sr-only">{m.spalte_aktionen()}</span>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          <For each={props.quelle.kunden()}>
            {(kunde) => (
              <Tr>
                <Td>
                  <span class="flex flex-wrap items-center gap-2">
                    {kunde.name}
                    <Stand archiviertAm={kunde.archiviertAm} />
                  </span>
                </Td>
                <Td class="text-muted-foreground">{kunde.nummer}</Td>
                <Td>
                  <Aktionen
                    name={kunde.name}
                    archiviertAm={kunde.archiviertAm}
                    archivieren={(an) => aktionen.archivieren(kunde.kundeId, an)}
                    entfernen={() => aktionen.entfernen(kunde.kundeId)}
                  />
                </Td>
              </Tr>
            )}
          </For>
        </Tbody>
      </Table>
    </div>
  );
};
