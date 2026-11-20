import { Button, Icon, Input, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { Trash2 } from "lucide";
import { createSignal, createUniqueId, For, Loading, Show } from "solid-js";
import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { NeuesToken } from "./neuesToken.tsx";
import { gueltigkeitText, kalendertag, tagVon } from "./text.ts";
import { GUELTIGKEITEN, type Gueltigkeit, type Zugang } from "./typen.ts";

const AENDERT = () => [alle(PFAD.zugaenge)];
/** A token that expires unless chosen otherwise: a forgotten one ends by itself */
const VORGABE: Gueltigkeit = 90;

/** The form for a new token: a name and an expiry */
const NeuerZugang = (props: { onAngelegt: (name: string, token: string) => void }) => {
  const id = createUniqueId();
  const [fehler, setFehler] = createSignal("");
  const anlegen = aenderung(
    (angaben: { name: string; gueltigTage: Gueltigkeit }) =>
      api<{ token: string }>(PFAD.zugaenge, { body: angaben }),
    AENDERT,
  );
  const senden = async (form: HTMLFormElement) => {
    const daten = new FormData(form);
    const name = String(daten.get("name")).trim();
    const wahl = String(daten.get("gueltigkeit"));
    const antwort = await anlegen.mutate({
      name,
      gueltigTage: wahl === "" ? null : (Number(wahl) as Gueltigkeit),
    });
    if (!antwort.ok) return setFehler(m.fehler_speichern());
    setFehler("");
    form.reset();
    props.onAngelegt(name, antwort.daten.token);
  };
  return (
    <form
      aria-label={m.zugang_anlegen()}
      class="flex flex-col gap-3 rounded-lg border border-border p-3 md:flex-row md:flex-wrap md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        void senden(event.currentTarget);
      }}
    >
      <Input label={m.zugang_name()} name="name" required maxlength={100} class="md:w-64" />
      <div class="flex flex-col gap-1.5">
        <label for={`${id}-gueltig`} class="font-medium">
          {m.zugang_gueltigkeit()}
        </label>
        <select id={`${id}-gueltig`} name="gueltigkeit" class={feld}>
          <For each={GUELTIGKEITEN}>
            {(tage) => (
              <option value={tage === null ? "" : String(tage)} selected={tage === VORGABE}>
                {gueltigkeitText(tage)}
              </option>
            )}
          </For>
        </select>
      </div>
      <Button
        type="submit"
        variant="outline"
        class="self-start md:self-end"
        disabled={anlegen.isPending}
      >
        {m.zugang_anlegen()}
      </Button>
      <div class="basis-full">
        <Fehler text={fehler()} />
      </div>
    </form>
  );
};

/** The person's tokens with the day each was made, expires and was last used */
const Liste = (props: { zugaenge: Zugang[]; widerrufen: (zugang: Zugang) => void }) => (
  <Table beschriftung={m.zugaenge_liste()}>
    <Thead>
      <Tr>
        <Th>{m.zugang_name()}</Th>
        <Th>{m.zugang_anfang()}</Th>
        <Th>{m.zugang_angelegt()}</Th>
        <Th>{m.zugang_ablauf()}</Th>
        <Th>{m.zugang_genutzt()}</Th>
        <Th>
          <span class="sr-only">{m.spalte_aktionen()}</span>
        </Th>
      </Tr>
    </Thead>
    <Tbody>
      <For each={props.zugaenge}>
        {(zugang) => (
          <Tr>
            <Td>{zugang.name}</Td>
            <Td class="font-mono text-[12px]">{zugang.praefix}…</Td>
            <Td>{tagVon(zugang.angelegtAm)}</Td>
            <Td>
              {zugang.gueltigBis === null ? m.zugang_unbegrenzt() : tagVon(zugang.gueltigBis)}
            </Td>
            <Td>
              {zugang.zuletztGenutzt === null ? m.zugang_nie() : kalendertag(zugang.zuletztGenutzt)}
            </Td>
            <Td>
              <div class="flex justify-end">
                <Button
                  variant="icon"
                  aria-label={m.zugang_widerrufen({ name: zugang.name })}
                  onClick={() => props.widerrufen(zugang)}
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

/**
 * Personal access tokens in the settings (S-607): for other programs and AI assistants, with the
 * rights of one's role. The server refuses the terminal's device with 403, and the section stays away.
 */
export const Zugaenge = () => {
  const abgefragt = abfrage<{ zugaenge: Zugang[] }>(ressourcen.zugaenge);
  const liste = () => daten(abgefragt.data)?.zugaenge;
  const [neu, setNeu] = createSignal<{ name: string; token: string } | null>(null);
  const [fehler, setFehler] = createSignal("");
  const widerrufen = aenderung(
    (zugang: Zugang) => api(`${PFAD.zugaenge}/${zugang.zugangId}`, { method: "DELETE" }),
    AENDERT,
  );
  const weg = async (zugang: Zugang) => {
    const antwort = await widerrufen.mutate(zugang);
    setFehler(antwort.ok ? "" : m.fehler_speichern());
  };
  return (
    <Loading>
      <Show when={liste()}>
        {(zugaenge) => (
          <section class="flex max-w-3xl flex-col gap-3">
            <h2 class="font-semibold">{m.zugaenge_titel()}</h2>
            <p class="text-muted-foreground">{m.zugaenge_text()}</p>
            <p class="text-muted-foreground">
              {m.zugaenge_adressen()}{" "}
              <code class="font-mono text-[12px]">{`${location.origin}/api/v1/openapi.json`}</code>
              {" · "}
              <code class="font-mono text-[12px]">{`${location.origin}/mcp`}</code>
            </p>
            <NeuerZugang onAngelegt={(name, token) => setNeu({ name, token })} />
            <Show when={neu()}>{(n) => <NeuesToken name={n().name} token={n().token} />}</Show>
            <Show
              when={zugaenge().length > 0}
              fallback={<p class="text-muted-foreground">{m.zugaenge_leer()}</p>}
            >
              <Liste zugaenge={zugaenge()} widerrufen={weg} />
            </Show>
            <Fehler text={fehler()} />
          </section>
        )}
      </Show>
    </Loading>
  );
};
