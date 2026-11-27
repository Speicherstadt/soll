import { tagInBerlin } from "@soll/arbeitszeit";
import { Button, DatePicker, Icon, Input, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { Trash2 } from "lucide";
import { createSignal, createUniqueId, For } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { centAus, euroText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import { Fehler } from "../rahmen/karte.tsx";
import { type ProjektQuelle, zeilenAktionen } from "./quelle.ts";
import { LeerText, NeuFormular } from "./teile.tsx";
import type { Satz } from "./typen.ts";
import { datumText, fehlerText, taetigkeitName } from "./werte.ts";

type Wahl = { wert: string; name: string };

/** A select of what a rate names, "alle" first */
const Auswahl = (props: {
  label: string;
  name: string;
  optionen: readonly Wahl[];
  disabled?: boolean;
  onChange?: (wert: string) => void;
}) => {
  const id = createUniqueId();
  return (
    <div class="flex flex-col gap-1.5">
      <label for={id} class="font-medium">
        {props.label}
      </label>
      <select
        id={id}
        name={props.name}
        class={feld}
        disabled={props.disabled}
        onChange={(event) => props.onChange?.(event.currentTarget.value)}
      >
        <option value="">{m.satz_alle()}</option>
        <For each={props.optionen}>{(o) => <option value={o.wert}>{o.name}</option>}</For>
      </select>
    </div>
  );
};

const leerAlsNull = (wert: FormDataEntryValue | null) => (wert ? String(wert) : null);

type Zeile = { archiviertAm: number | null };

/** What a rate can name, as choices; `nurAktive` leaves out what is archived (for a new rate) */
const wahlen = (quelle: ProjektQuelle, nurAktive: boolean) => {
  const aktiv = <T extends Zeile>(liste: readonly T[]) =>
    nurAktive ? liste.filter((zeile) => zeile.archiviertAm === null) : liste;
  return {
    kunden: (): Wahl[] => aktiv(quelle.kunden()).map((k) => ({ wert: k.kundeId, name: k.name })),
    auftraege: (): Wahl[] =>
      aktiv(quelle.projekte()).map((p) => ({ wert: p.projektId, name: p.name })),
    taetigkeiten: (): Wahl[] =>
      aktiv(quelle.taetigkeiten()).map((t) => ({ wert: t.taetigkeitId, name: taetigkeitName(t) })),
    personen: (): Wahl[] => quelle.personen().map((p) => ({ wert: p.nutzerId, name: p.name })),
  };
};

/** The new rate: what it names (empty is "alle"), euros per hour and the day it holds from */
const NeuerSatz = (props: { quelle: ProjektQuelle }) => {
  const [fehler, setFehler] = createSignal("");
  const [mitAuftrag, setMitAuftrag] = createSignal(false);
  const aktionen = zeilenAktionen("saetze", setFehler);
  const wahl = wahlen(props.quelle, true);
  const anlegen = async (daten: FormData, form: HTMLFormElement) => {
    const cent = centAus(String(daten.get("betrag")));
    if (cent === null) {
      setFehler("ungueltig");
      return false;
    }
    const projektId = leerAlsNull(daten.get("projekt"));
    const ok = await aktionen.anlegen({
      // an order brings its customer: a rate names one of them
      kundeId: projektId ? null : leerAlsNull(daten.get("kunde")),
      projektId,
      taetigkeitId: leerAlsNull(daten.get("taetigkeit")),
      nutzerId: leerAlsNull(daten.get("person")),
      gueltigAb: String(daten.get("ab")),
      centProStunde: cent,
    });
    if (!ok) return false;
    form.reset();
    setMitAuftrag(false);
    return true;
  };
  const abId = createUniqueId();
  return (
    <NeuFormular
      label={m.satz_anlegen()}
      knopf={m.satz_anlegen()}
      fehler={fehler()}
      arbeitet={aktionen.arbeitet()}
      onSubmit={anlegen}
    >
      <Auswahl label={m.satz_taetigkeit()} name="taetigkeit" optionen={wahl.taetigkeiten()} />
      <Auswahl
        label={m.satz_auftrag()}
        name="projekt"
        optionen={wahl.auftraege()}
        onChange={(wert) => setMitAuftrag(wert !== "")}
      />
      <Auswahl
        label={m.satz_kunde()}
        name="kunde"
        optionen={wahl.kunden()}
        disabled={mitAuftrag()}
      />
      <Auswahl label={m.satz_person()} name="person" optionen={wahl.personen()} />
      <Input label={m.satz_betrag()} name="betrag" inputmode="decimal" required />
      <div class="flex flex-col gap-1.5">
        <label for={abId} class="font-medium">
          {m.satz_gueltig_ab()}
        </label>
        <DatePicker id={abId} name="ab" required defaultValue={tagInBerlin(Date.now())} />
      </div>
    </NeuFormular>
  );
};

/** The rates with what they name, in the order of their day */
const SatzTabelle = (props: { quelle: ProjektQuelle; entfernen: (satzId: string) => void }) => {
  const wahl = wahlen(props.quelle, false);
  const namen = (satz: Satz) => {
    const finden = (liste: readonly Wahl[], id: string | null) =>
      id === null ? null : (liste.find((o) => o.wert === id)?.name ?? "?");
    const teile = [
      finden(wahl.taetigkeiten(), satz.taetigkeitId),
      finden(wahl.auftraege(), satz.projektId),
      finden(wahl.kunden(), satz.kundeId),
      finden(wahl.personen(), satz.nutzerId),
    ].filter((teil): teil is string => teil !== null);
    return teile.length === 0 ? m.satz_betrieb() : teile.join(" · ");
  };
  return (
    <Table beschriftung={m.saetze_liste()}>
      <Thead>
        <Tr>
          <Th>{m.satz_fuer()}</Th>
          <Th>{m.satz_gueltig_ab()}</Th>
          <Th>{m.satz_betrag()}</Th>
          <Th>
            <span class="sr-only">{m.spalte_aktionen()}</span>
          </Th>
        </Tr>
      </Thead>
      <Tbody>
        <For each={props.quelle.saetze()}>
          {(satz) => (
            <Tr>
              <Td>{namen(satz)}</Td>
              <Td>{datumText(satz.gueltigAb)}</Td>
              <Td>{euroText(satz.centProStunde, getLocale())}</Td>
              <Td>
                <div class="flex justify-end">
                  <Button
                    variant="icon"
                    aria-label={m.entfernen({ name: namen(satz) })}
                    onClick={() => props.entfernen(satz.satzId)}
                  >
                    <Icon icon={Trash2} />
                  </Button>
                </div>
              </Td>
            </Tr>
          )}
        </For>
      </Tbody>
    </Table>
  );
};

/** The hourly rates of the business with their precedence, for owner and planner (S-601) */
export const Saetze = (props: { quelle: ProjektQuelle }) => {
  const [fehler, setFehler] = createSignal("");
  const aktionen = zeilenAktionen("saetze", setFehler);
  return (
    <div class="flex flex-col gap-4">
      <p class="max-w-2xl text-muted-foreground">{m.saetze_vorrang()}</p>
      <NeuerSatz quelle={props.quelle} />
      <LeerText leer={props.quelle.saetze().length === 0} text={m.saetze_leer()} />
      <SatzTabelle quelle={props.quelle} entfernen={(id) => aktionen.entfernen(id)} />
      <Fehler text={fehler() ? fehlerText(fehler()) : ""} />
    </div>
  );
};
