import { Input, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { centAus, dauerText, euroText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import { Fehler } from "../rahmen/karte.tsx";
import { type ProjektQuelle, zeilenAktionen } from "./quelle.ts";
import { Aktionen, LeerText, NeuFormular, Stand } from "./teile.tsx";
import type { Projekt } from "./typen.ts";
import { budgetMinutenAus, fehlerText } from "./werte.ts";

/** The budget of an order in hours and (for whoever keeps the orders) euros, with its threshold */
const budgetText = (projekt: Projekt): string => {
  const teile = [
    projekt.budgetMinuten === null ? null : dauerText(projekt.budgetMinuten),
    projekt.budgetCent == null ? null : euroText(projekt.budgetCent, getLocale()),
  ].filter((teil): teil is string => teil !== null);
  return teile.length === 0 ? m.budget_keins() : teile.join(" · ");
};

/** An optional field: empty is none, anything else must read as a value */
const optional = (text: string, lesen: (text: string) => number | null) =>
  text.trim() === "" ? { wert: null } : { wert: lesen(text), ungueltig: lesen(text) === null };

/** The new order: customer, name, number, budget in hours and euros, threshold of the warning */
const NeuerAuftrag = (props: { quelle: ProjektQuelle }) => {
  const id = createUniqueId();
  const [fehler, setFehler] = createSignal("");
  const [arbeitet, setArbeitet] = createSignal(false);
  const aktionen = zeilenAktionen("projekte", props.quelle, setFehler);
  const kunden = () => props.quelle.kunden().filter((kunde) => kunde.archiviertAm === null);
  const anlegen = async (daten: FormData, form: HTMLFormElement) => {
    const minuten = optional(String(daten.get("stunden")), budgetMinutenAus);
    const cent = optional(String(daten.get("euro")), centAus);
    if (minuten.ungueltig || cent.ungueltig) return setFehler("ungueltig");
    const nummer = String(daten.get("nummer")).trim();
    setArbeitet(true);
    const ok = await aktionen.anlegen({
      kundeId: String(daten.get("kunde")),
      name: String(daten.get("name")).trim(),
      ...(nummer ? { nummer } : {}),
      budgetMinuten: minuten.wert,
      budgetCent: cent.wert,
      warnungProzent: Number(daten.get("warnung")),
    });
    setArbeitet(false);
    if (ok) form.reset();
  };
  return (
    <Show
      when={kunden().length > 0}
      fallback={<p class="text-muted-foreground">{m.auftrag_kunde_fehlt()}</p>}
    >
      <NeuFormular
        label={m.auftrag_anlegen()}
        knopf={m.auftrag_anlegen()}
        fehler={fehler()}
        arbeitet={arbeitet()}
        onSubmit={anlegen}
      >
        <div class="flex flex-col gap-1.5 md:w-48">
          <label for={`${id}-kunde`} class="font-medium">
            {m.auftrag_kunde()}
          </label>
          <select id={`${id}-kunde`} name="kunde" class={feld} required>
            <For each={kunden()}>
              {(kunde) => <option value={kunde.kundeId}>{kunde.name}</option>}
            </For>
          </select>
        </div>
        <Input label={m.auftrag_name()} name="name" required maxlength={100} class="md:w-56" />
        <Input label={m.auftrag_nummer()} name="nummer" maxlength={40} class="md:w-36" />
        <Input
          label={m.auftrag_budget_stunden()}
          hinweis={m.auftrag_budget_stunden_hinweis()}
          name="stunden"
          inputmode="numeric"
          class="md:w-44"
        />
        <Input
          label={m.auftrag_budget_euro()}
          hinweis={m.auftrag_budget_euro_hinweis()}
          name="euro"
          inputmode="decimal"
          class="md:w-44"
        />
        <Input
          label={m.auftrag_warnung()}
          name="warnung"
          type="number"
          min={1}
          max={100}
          step={1}
          value="80"
          required
          class="md:w-32"
        />
      </NeuFormular>
    </Show>
  );
};

/** The orders: everyone who books project time reads them, owner and planner keep them (S-601) */
export const Auftraege = (props: { quelle: ProjektQuelle }) => {
  const [fehler, setFehler] = createSignal("");
  const aktionen = zeilenAktionen("projekte", props.quelle, setFehler);
  const kundeName = (kundeId: string) =>
    props.quelle.kunden().find((kunde) => kunde.kundeId === kundeId)?.name ?? "";
  return (
    <div class="flex flex-col gap-4">
      <Show when={props.quelle.verwalten}>
        <NeuerAuftrag quelle={props.quelle} />
      </Show>
      <LeerText leer={props.quelle.projekte().length === 0} text={m.auftraege_leer()} />
      <Table beschriftung={m.auftraege_liste()}>
        <Thead>
          <Tr>
            <Th>{m.auftrag_name()}</Th>
            <Th>{m.spalte_budget()}</Th>
            <Show when={props.quelle.verwalten}>
              <Th>
                <span class="sr-only">{m.spalte_aktionen()}</span>
              </Th>
            </Show>
          </Tr>
        </Thead>
        <Tbody>
          <For each={props.quelle.projekte()}>
            {(projekt) => (
              <Tr>
                <Td class="py-1.5">
                  <span class="flex flex-wrap items-center gap-2">
                    <span class="font-medium">{projekt.name}</span>
                    <Stand archiviertAm={projekt.archiviertAm} />
                  </span>
                  <span class="block text-[12px] text-muted-foreground">
                    {[kundeName(projekt.kundeId), projekt.nummer].filter(Boolean).join(" · ")}
                  </span>
                </Td>
                <Td class="py-1.5">
                  <span class="block">{budgetText(projekt)}</span>
                  <Show when={projekt.budgetMinuten !== null || projekt.budgetCent != null}>
                    <span class="block text-[12px] text-muted-foreground">
                      {m.budget_warnung_ab({ prozent: String(projekt.warnungProzent) })}
                    </span>
                  </Show>
                </Td>
                <Show when={props.quelle.verwalten}>
                  <Td>
                    <Aktionen
                      name={projekt.name}
                      archiviertAm={projekt.archiviertAm}
                      archivieren={(an) => aktionen.archivieren(projekt.projektId, an)}
                      entfernen={() => aktionen.entfernen(projekt.projektId)}
                    />
                  </Td>
                </Show>
              </Tr>
            )}
          </For>
        </Tbody>
      </Table>
      <Fehler text={fehler() ? fehlerText(fehler()) : ""} />
    </div>
  );
};
