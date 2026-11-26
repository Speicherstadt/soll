import { Badge, Checkbox, Input, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { createSignal, For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { type ProjektQuelle, zeilenAktionen } from "./quelle.ts";
import { Aktionen, NeuFormular, Stand } from "./teile.tsx";
import type { Taetigkeit } from "./typen.ts";
import { taetigkeitName } from "./werte.ts";

/** Whether the business bills an activity: a switch for owner and planner, a word for the others */
const Abrechenbar = (props: {
  taetigkeit: Taetigkeit;
  verwalten: boolean;
  aendern: (abrechenbar: boolean) => void;
}) => (
  <Show
    when={props.verwalten}
    fallback={
      <Show when={props.taetigkeit.abrechenbar}>
        <span class="text-muted-foreground">{m.taetigkeit_abrechenbar()}</span>
      </Show>
    }
  >
    <Checkbox
      class="min-h-9"
      checked={props.taetigkeit.abrechenbar}
      aria-label={m.taetigkeit_abrechenbar_fuer({ name: taetigkeitName(props.taetigkeit) })}
      onChange={(event) => props.aendern(event.currentTarget.checked)}
    >
      <span aria-hidden="true">{m.taetigkeit_abrechenbar()}</span>
    </Checkbox>
  </Show>
);

/** One activity: its name (the app's for a fixed one), billing and, for own ones, the actions */
const TaetigkeitZeile = (props: {
  taetigkeit: Taetigkeit;
  verwalten: boolean;
  aktionen: ReturnType<typeof zeilenAktionen>;
}) => (
  <Tr>
    <Td>
      <span class="flex flex-wrap items-center gap-2">
        {taetigkeitName(props.taetigkeit)}
        <Show when={props.taetigkeit.fest}>
          <Badge>{m.taetigkeit_intern()}</Badge>
        </Show>
        <Stand archiviertAm={props.taetigkeit.archiviertAm} />
      </span>
    </Td>
    <Td>
      <Abrechenbar
        taetigkeit={props.taetigkeit}
        verwalten={props.verwalten}
        aendern={(abrechenbar) =>
          props.aktionen.aendern(props.taetigkeit.taetigkeitId, { abrechenbar })
        }
      />
    </Td>
    <Show when={props.verwalten}>
      <Td>
        <Show when={!props.taetigkeit.fest}>
          <Aktionen
            name={props.taetigkeit.name}
            archiviertAm={props.taetigkeit.archiviertAm}
            archivieren={(an) => props.aktionen.archivieren(props.taetigkeit.taetigkeitId, an)}
            entfernen={() => props.aktionen.entfernen(props.taetigkeit.taetigkeitId)}
          />
        </Show>
      </Td>
    </Show>
  </Tr>
);

/** The four fixed internal activities and the business's own (S-601) */
export const Taetigkeiten = (props: { quelle: ProjektQuelle }) => {
  const [fehler, setFehler] = createSignal("");
  const aktionen = zeilenAktionen("taetigkeiten", setFehler);
  const anlegen = async (daten: FormData, form: HTMLFormElement) => {
    const ok = await aktionen.anlegen({
      name: String(daten.get("name")).trim(),
      abrechenbar: daten.get("abrechenbar") === "ja",
    });
    if (ok) form.reset();
  };
  return (
    <div class="flex flex-col gap-4">
      <Show when={props.quelle.verwalten}>
        <NeuFormular
          label={m.taetigkeit_anlegen()}
          knopf={m.taetigkeit_anlegen()}
          fehler={fehler()}
          arbeitet={aktionen.arbeitet()}
          onSubmit={anlegen}
        >
          <Input label={m.taetigkeit_name()} name="name" required maxlength={100} class="md:w-64" />
          <Checkbox name="abrechenbar" value="ja" checked class="min-h-9">
            {m.taetigkeit_abrechenbar()}
          </Checkbox>
        </NeuFormular>
      </Show>
      <Table beschriftung={m.taetigkeiten_liste()}>
        <Thead>
          <Tr>
            <Th>{m.taetigkeit_name()}</Th>
            <Th>{m.taetigkeit_abrechenbar()}</Th>
            <Show when={props.quelle.verwalten}>
              <Th>
                <span class="sr-only">{m.spalte_aktionen()}</span>
              </Th>
            </Show>
          </Tr>
        </Thead>
        <Tbody>
          <For each={props.quelle.taetigkeiten()}>
            {(taetigkeit) => (
              <TaetigkeitZeile
                taetigkeit={taetigkeit}
                verwalten={props.quelle.verwalten}
                aktionen={aktionen}
              />
            )}
          </For>
        </Tbody>
      </Table>
    </div>
  );
};
