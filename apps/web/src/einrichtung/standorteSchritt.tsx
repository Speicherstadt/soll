import { LAENDER, type Land, REGIONEN, type Region } from "@soll/arbeitszeit";
import { Button, Checkbox, Icon, Input } from "@soll/ui";
import { Trash2 } from "lucide";
import { createSignal, createUniqueId, For, Loading, Show } from "solid-js";
import { abfrage, aenderung, daten, listeAendern } from "../abfragen/abfrage.ts";
import { alle, PFAD, ressourcen } from "../abfragen/schluessel.ts";
import { type Antwort, api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Fuss, SchrittKopf } from "./geruest.tsx";
import { LAND_NAMEN, REGION_NAMEN } from "./namen.ts";
import { feld } from "./stil.ts";

type Standort = {
  standortId: string;
  name: string;
  adresse: string;
  land: Land;
  regionen: Region[];
};

const regionenVon = (land: string) =>
  (Object.keys(REGIONEN) as Region[]).filter((region) => REGIONEN[region] === land);

type Eingabe = Omit<Standort, "standortId">;

/** What a change to the sites changes: the sites as loaded (here and in the plan) */
const STANDORTE_AENDERT = [alle(PFAD.standorte)];

/** A new site: name, address, Land (the business's by default) and the regions of that Land */
const NeuerStandort = (props: {
  land: string;
  anlegen: (eingabe: Eingabe) => Promise<Antwort<Standort>>;
  arbeitet: boolean;
}) => {
  const landId = createUniqueId();
  // the business's Land until the person chooses another
  const [land, setLand] = createSignal(() => props.land);
  const [fehler, setFehler] = createSignal("");
  let landFeld: HTMLSelectElement | undefined;
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    // a second click while the first is on its way would add the site twice
    if (props.arbeitet) return;
    const form = event.currentTarget as HTMLFormElement;
    const eingabe = new FormData(form);
    const antwort = await props.anlegen({
      name: String(eingabe.get("name")).trim(),
      adresse: String(eingabe.get("adresse")).trim(),
      land: land() as Land,
      regionen: eingabe.getAll("regionen").map(String) as Region[],
    });
    if (!antwort.ok) return setFehler(m.fehler_speichern());
    setFehler("");
    form.reset();
    // reset() puts the select on its first option; the next site gets the Land it shows
    if (landFeld) landFeld.value = land();
  };
  return (
    <form class="flex flex-col gap-3 rounded-lg border border-border p-3" onSubmit={absenden}>
      <Input
        label={m.standort_name()}
        hinweis={m.standort_name_hinweis()}
        name="name"
        required
        maxlength={100}
      />
      <Input
        label={m.standort_adresse()}
        name="adresse"
        maxlength={200}
        autocomplete="street-address"
      />
      <div class="flex flex-col gap-1.5">
        <label for={landId} class="font-medium">
          {m.betrieb_land()}
        </label>
        <select
          ref={(el: HTMLSelectElement) => {
            landFeld = el;
          }}
          id={landId}
          class={feld}
          value={land()}
          onChange={(e) => setLand(e.currentTarget.value)}
        >
          <For each={LAENDER}>{(code) => <option value={code}>{LAND_NAMEN[code]()}</option>}</For>
        </select>
      </div>
      <Show when={regionenVon(land()).length > 0}>
        <fieldset class="flex flex-col gap-1.5">
          <legend class="mb-1 font-medium">{m.standort_regionen()}</legend>
          <For each={regionenVon(land())}>
            {(region) => (
              <Checkbox name="regionen" value={region} class="min-h-7">
                {REGION_NAMEN[region]()}
              </Checkbox>
            )}
          </For>
        </fieldset>
      </Show>
      <Fehler text={fehler()} />
      <Button type="submit" variant="outline" class="self-start" disabled={props.arbeitet}>
        {m.standort_hinzufuegen()}
      </Button>
    </form>
  );
};

/** Step 2: where people work; the Land and regions of a site decide its holidays (S-105) */
export const StandorteSchritt = (props: {
  land: string;
  nummer: number;
  anzahl: number;
  zurueck?: (() => void) | undefined;
  weiter: () => void;
}) => {
  const standorteAbfrage = abfrage<{ standorte: Standort[] }>(ressourcen.standorte);
  const standorte = () => daten(standorteAbfrage.data)?.standorte ?? [];
  const [fehler, setFehler] = createSignal("");
  const anlegen = aenderung(
    (eingabe: Eingabe) => api<Standort>("/api/v1/standorte", { body: eingabe }),
    () => STANDORTE_AENDERT,
    {
      eintragen: (client, _, neu) =>
        listeAendern<Standort>(client, ressourcen.standorte(), "standorte", (liste) => [
          ...liste,
          neu,
        ]),
    },
  );
  const entfernen = aenderung(
    (standort: Standort) => api(`/api/v1/standorte/${standort.standortId}`, { method: "DELETE" }),
    () => STANDORTE_AENDERT,
    {
      eintragen: (client, weg) =>
        listeAendern<Standort>(client, ressourcen.standorte(), "standorte", (liste) =>
          liste.filter((x) => x.standortId !== weg.standortId),
        ),
    },
  );
  const arbeitet = () => anlegen.isPending;
  // before the list has loaded, it is read as empty, as the page shows it
  const weiter = () =>
    !standorteAbfrage.isPending && standorte().length > 0
      ? props.weiter()
      : setFehler(m.standort_fehlt());
  return (
    <>
      <SchrittKopf id="schritt-titel" titel={m.standorte_titel()} text={m.standorte_text()} />
      <Loading>
        <Show when={standorte().length > 0}>
          <ul
            aria-label={m.standorte_liste()}
            class="flex flex-col divide-y divide-border rounded-lg border border-border"
          >
            <For each={standorte()}>
              {(standort) => (
                <li class="flex items-center justify-between gap-3 px-3 py-2">
                  <span class="flex min-w-0 flex-col">
                    <span class="font-medium">{standort.name}</span>
                    <span class="truncate text-muted-foreground">
                      {[standort.adresse, LAND_NAMEN[standort.land]()].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <Button
                    variant="icon"
                    aria-label={m.standort_entfernen({ name: standort.name })}
                    onClick={() => void entfernen.mutate(standort)}
                  >
                    <Icon icon={Trash2} />
                  </Button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Loading>
      <NeuerStandort
        land={props.land}
        arbeitet={arbeitet()}
        anlegen={async (eingabe) => {
          const antwort = await anlegen.mutate(eingabe);
          if (antwort.ok) setFehler("");
          return antwort;
        }}
      />
      <Fehler text={fehler()} />
      <Fuss
        nummer={props.nummer}
        anzahl={props.anzahl}
        zurueck={props.zurueck}
        weiter={weiter}
        arbeitet={arbeitet()}
      />
    </>
  );
};
