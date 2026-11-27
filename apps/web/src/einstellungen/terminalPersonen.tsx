import { Button, Dialog, Input, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { createSignal, For, Loading, Show } from "solid-js";
import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { AusweisDialog } from "./ausweis.tsx";

type Person = { nutzerId: string; name: string; pin: boolean; ausweis: boolean };

/** What a PIN or a QR code changes: the list of who stamps how */
const AENDERT = () => [alle(PFAD.terminalPersonen)];

const PIN_FEHLER: Record<string, () => string> = {
  pin_vergeben: () => m.terminal_pin_vergeben(),
  ungueltig: () => m.terminal_pin_ungueltig(),
};

/** Setting a PIN: typed once, sent once, never shown again (the server keeps hashes only) */
const PinDialog = (props: {
  person: Person | null;
  onSchliessen: () => void;
  onGesetzt: () => void;
}) => {
  const [fehler, setFehler] = createSignal("");
  const setzen = aenderung(
    (wahl: { nutzerId: string; pin: string }) =>
      api(`/api/v1/terminal/pins/${wahl.nutzerId}`, { method: "PUT", body: { pin: wahl.pin } }),
    AENDERT,
  );
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const pin = String(new FormData(form).get("pin") ?? "");
    const antwort = await setzen.mutate({ nutzerId: props.person?.nutzerId ?? "", pin });
    if (!antwort.ok) return setFehler((PIN_FEHLER[antwort.fehler] ?? m.fehler_speichern)());
    setFehler("");
    form.reset();
    props.onGesetzt();
  };
  return (
    <Dialog
      offen={props.person !== null}
      titel={m.terminal_pin_setzen_name({ name: props.person?.name ?? "" })}
      onSchliessen={() => {
        setFehler("");
        props.onSchliessen();
      }}
    >
      <form class="flex flex-col gap-3" onSubmit={absenden}>
        <Input
          label={m.terminal_pin_feld()}
          name="pin"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          pattern="[0-9]{6,8}"
          required
          fehler={fehler()}
        />
        <div class="flex justify-end gap-2">
          <Button variant="outline" onClick={props.onSchliessen}>
            {m.abbrechen()}
          </Button>
          <Button type="submit" disabled={setzen.isPending}>
            {m.terminal_speichern()}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

/**
 * Who stamps at the terminal and how (S-801): the PIN, which alone recognises a person and is unique
 * in the business, and the QR code, issued for printing, issued anew or revoked
 */
export const TerminalPersonen = () => {
  const abgefragt = abfrage<{ personen: Person[] }>(ressourcen.terminalPersonen);
  const personen = () => daten(abgefragt.data)?.personen ?? [];
  const [pinFuer, setPinFuer] = createSignal<Person | null>(null);
  const [ausweis, setAusweis] = createSignal<{ name: string; wert: string } | null>(null);
  const [fehler, setFehler] = createSignal("");
  const ausweisPfad = (person: Person) => `/api/v1/terminal/ausweise/${person.nutzerId}`;
  const ausstellung = aenderung(
    (person: Person) => api<{ wert: string }>(ausweisPfad(person), { body: {} }),
    AENDERT,
  );
  const entzug = aenderung(
    (person: Person) => api(ausweisPfad(person), { method: "DELETE" }),
    AENDERT,
  );
  const ausstellen = async (person: Person) => {
    const antwort = await ausstellung.mutate(person);
    if (!antwort.ok) return setFehler(m.fehler_speichern());
    setFehler("");
    setAusweis({ name: person.name, wert: antwort.daten.wert });
  };
  const entziehen = async (person: Person) => {
    const antwort = await entzug.mutate(person);
    setFehler(antwort.ok ? "" : m.fehler_speichern());
  };
  return (
    <section class="flex flex-col gap-3">
      <h2 class="font-semibold">{m.terminal_personen_titel()}</h2>
      <p class="text-muted-foreground">{m.terminal_personen_text()}</p>
      <Table beschriftung={m.terminal_personen_titel()}>
        <Thead>
          <Tr>
            <Th>{m.terminal_spalte_name()}</Th>
            <Th>{m.terminal_spalte_pin()}</Th>
            <Th>{m.terminal_spalte_qr()}</Th>
          </Tr>
        </Thead>
        <Tbody>
          <Loading>
            <For each={personen()} keyed={(person) => person.nutzerId}>
              {(person) => (
                <Tr>
                  <Td>{person().name}</Td>
                  <Td>
                    <span class="flex items-center gap-2">
                      {person().pin ? m.terminal_vorhanden() : m.terminal_fehlt()}
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={m.terminal_pin_setzen_name({ name: person().name })}
                        onClick={() => setPinFuer(person())}
                      >
                        {m.terminal_pin_setzen()}
                      </Button>
                    </span>
                  </Td>
                  <Td>
                    <span class="flex items-center gap-2">
                      {person().ausweis ? m.terminal_vorhanden() : m.terminal_fehlt()}
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={(person().ausweis
                          ? m.terminal_qr_neu_name
                          : m.terminal_qr_ausstellen_name)({ name: person().name })}
                        onClick={() => ausstellen(person())}
                      >
                        {person().ausweis ? m.terminal_qr_neu() : m.terminal_qr_ausstellen()}
                      </Button>
                      <Show when={person().ausweis}>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={m.terminal_qr_entziehen_name({ name: person().name })}
                          onClick={() => entziehen(person())}
                        >
                          {m.terminal_qr_entziehen()}
                        </Button>
                      </Show>
                    </span>
                  </Td>
                </Tr>
              )}
            </For>
          </Loading>
        </Tbody>
      </Table>
      <Fehler text={fehler()} />
      <PinDialog
        person={pinFuer()}
        onSchliessen={() => setPinFuer(null)}
        onGesetzt={() => setPinFuer(null)}
      />
      <AusweisDialog ausweis={ausweis()} onSchliessen={() => setAusweis(null)} />
    </section>
  );
};
