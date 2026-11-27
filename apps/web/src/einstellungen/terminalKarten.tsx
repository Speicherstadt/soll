import { Button, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { createSignal, For, Loading, Show } from "solid-js";
import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { zeitpunktText } from "../zeiten/text.ts";
import { KarteDialog, type Kartenart } from "./karteDialog.tsx";

type Karte = {
  karteId: string;
  nutzerId: string;
  name: string;
  art: Kartenart;
  angelegtAm: number;
};

const ART: Record<Kartenart, () => string> = {
  uid: () => m.terminal_karte_einfach(),
  ntag424: () => m.terminal_karte_ntag(),
};

/**
 * The NFC cards of the terminal (S-802): who holds which kind of card since when, each revocable at
 * once, and a dialog to enter one; no UID or key comes back from the server
 */
export const TerminalKarten = () => {
  const abgefragt = abfrage<{ karten: Karte[] }>(ressourcen.terminalKarten);
  const personenAbfrage = abfrage<{ personen: { nutzerId: string; name: string }[] }>(
    ressourcen.terminalPersonen,
  );
  const karten = () => daten(abgefragt.data)?.karten ?? [];
  const personen = () => daten(personenAbfrage.data)?.personen ?? [];
  const [offen, setOffen] = createSignal(false);
  const [fehler, setFehler] = createSignal("");
  const entzug = aenderung(
    (karte: Karte) => api(`${PFAD.terminalKarten}/${karte.karteId}`, { method: "DELETE" }),
    () => [alle(PFAD.terminalKarten)],
  );
  const entziehen = async (karte: Karte) => {
    const antwort = await entzug.mutate(karte);
    setFehler(antwort.ok ? "" : m.fehler_speichern());
  };
  return (
    <section class="flex flex-col items-start gap-3">
      <h2 class="font-semibold">{m.terminal_karten_titel()}</h2>
      <p class="text-muted-foreground">{m.terminal_karten_text()}</p>
      <Show when={karten().length > 0} fallback={<p>{m.terminal_karten_keine()}</p>}>
        <Table beschriftung={m.terminal_karten_titel()}>
          <Thead>
            <Tr>
              <Th>{m.terminal_spalte_name()}</Th>
              <Th>{m.terminal_spalte_art()}</Th>
              <Th>{m.terminal_spalte_eingetragen()}</Th>
              <Th>
                <span class="sr-only">{m.terminal_qr_entziehen()}</span>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            <Loading>
              <For each={karten()} keyed={(karte) => karte.karteId}>
                {(karte) => (
                  <Tr>
                    <Td>{karte().name}</Td>
                    <Td>{ART[karte().art]()}</Td>
                    <Td>{zeitpunktText(karte().angelegtAm)}</Td>
                    <Td>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={m.terminal_karte_entziehen_name({ name: karte().name })}
                        onClick={() => entziehen(karte())}
                      >
                        {m.terminal_qr_entziehen()}
                      </Button>
                    </Td>
                  </Tr>
                )}
              </For>
            </Loading>
          </Tbody>
        </Table>
      </Show>
      <Button variant="outline" onClick={() => setOffen(true)}>
        {m.terminal_karte_eintragen()}
      </Button>
      <Fehler text={fehler()} />
      <KarteDialog offen={offen()} personen={personen()} onSchliessen={() => setOffen(false)} />
    </section>
  );
};
