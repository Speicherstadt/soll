import { Button, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import type { Kunde } from "../projekte/typen.ts";
import { Fehler } from "../rahmen/karte.tsx";
import { kontakteQuelle, kontaktVerbinden } from "./quelle.ts";
import { habenFehler } from "./text.ts";
import type { HabenKontakt } from "./typen.ts";

/** A contact not linked yet: choose a customer of the business, or take it over as a new one */
const Verbinden = (props: {
  kontakt: HabenKontakt;
  kunden: Kunde[];
  onFehler: (text: string) => void;
}) => {
  const id = createUniqueId();
  const [kundeId, setKundeId] = createSignal("");
  const verbinden = kontaktVerbinden();
  return (
    <div class="flex flex-col gap-2 md:flex-row md:items-center">
      <label for={id} class="sr-only">
        {m.haben_kunde_fuer({ name: props.kontakt.name })}
      </label>
      <select
        id={id}
        class={`${feld} md:w-56`}
        value={kundeId()}
        onChange={(event) => setKundeId(event.currentTarget.value)}
      >
        <option value="">{m.haben_neuer_kunde()}</option>
        <For each={props.kunden}>
          {(kunde) => <option value={kunde.kundeId}>{kunde.name}</option>}
        </For>
      </select>
      <Button
        variant="outline"
        disabled={verbinden.isPending}
        aria-label={m.haben_verbinden_mit({ name: props.kontakt.name })}
        onClick={async () => {
          const antwort = await verbinden.mutate({
            kontaktId: props.kontakt.id,
            kundeId: kundeId(),
          });
          props.onFehler(antwort.ok ? "" : habenFehler(antwort.fehler));
        }}
      >
        {m.haben_verbinden()}
      </Button>
    </div>
  );
};

/**
 * The contacts in Haben ("Kunden lesen", S-606), each with the customer of the business it is
 * linked to; only a linked customer's bookings can go to Haben
 */
export const KontaktListe = (props: { kunden: Kunde[] }) => {
  const quelle = kontakteQuelle();
  const [fehler, setFehler] = createSignal("");
  const kundeName = (kundeId: string) =>
    props.kunden.find((k) => k.kundeId === kundeId)?.name ?? "";
  const frei = () => props.kunden.filter((k) => k.archiviertAm === null && !k.externQuelle);
  return (
    <div class="flex flex-col gap-3">
      <Fehler text={quelle.fehler() ? habenFehler(quelle.fehler()) : fehler()} />
      <Show
        when={quelle.kontakte().length > 0 || quelle.fehler()}
        fallback={<p class="text-muted-foreground">{m.haben_kontakte_leer()}</p>}
      >
        <Table beschriftung={m.haben_kontakte()}>
          <Thead>
            <Tr>
              <Th>{m.haben_kontakt()}</Th>
              <Th>{m.haben_kunde_in_soll()}</Th>
            </Tr>
          </Thead>
          <Tbody>
            <For each={quelle.kontakte()}>
              {(kontakt) => (
                <Tr>
                  <Td>
                    <span class="block">{kontakt.name}</span>
                    <Show when={kontakt.kundennummer}>
                      <span class="block text-[12px] text-muted-foreground">
                        {kontakt.kundennummer}
                      </span>
                    </Show>
                  </Td>
                  <Td>
                    <Show
                      when={kontakt.kundeId}
                      fallback={
                        <Verbinden kontakt={kontakt} kunden={frei()} onFehler={setFehler} />
                      }
                    >
                      {(kundeId) => (
                        <span>{m.haben_verbunden_kunde({ name: kundeName(kundeId()) })}</span>
                      )}
                    </Show>
                  </Td>
                </Tr>
              )}
            </For>
          </Tbody>
        </Table>
      </Show>
    </div>
  );
};
