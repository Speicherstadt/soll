import { LAENDER, type Land, REGIONEN, type Region } from "@soll/arbeitszeit";
import { Button, Icon, Input } from "@soll/ui";
import { Trash2 } from "lucide";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { api } from "../api.ts";
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

/** A new site: name, address, Land (the business's by default) and the regions of that Land */
const NeuerStandort = (props: {
  land: string;
  angelegt: (standort: Standort) => void;
  arbeitet: boolean;
  setzeArbeitet: (arbeitet: boolean) => void;
}) => {
  const landId = createUniqueId();
  const [land, setLand] = createSignal(props.land);
  const [fehler, setFehler] = createSignal("");
  let landFeld: HTMLSelectElement | undefined;
  // a second click while the first is on its way would add the site twice
  let laeuft = false;
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    if (laeuft) return;
    laeuft = true;
    props.setzeArbeitet(true);
    const form = event.currentTarget as HTMLFormElement;
    const daten = new FormData(form);
    const antwort = await api<Standort>("/api/v1/standorte", {
      body: {
        name: String(daten.get("name")).trim(),
        adresse: String(daten.get("adresse")).trim(),
        land: land(),
        regionen: daten.getAll("regionen").map(String),
      },
    });
    laeuft = false;
    props.setzeArbeitet(false);
    if (!antwort.ok) return setFehler(m.fehler_speichern());
    setFehler("");
    form.reset();
    // reset() puts the select on its first option; the next site gets the Land it shows
    if (landFeld) landFeld.value = land();
    props.angelegt(antwort.daten);
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
              <label class="flex min-h-7 items-center gap-2">
                <input type="checkbox" name="regionen" value={region} />
                {REGION_NAMEN[region]()}
              </label>
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
  const [standorte, setStandorte] = createSignal<Standort[]>([]);
  const [fehler, setFehler] = createSignal("");
  const [arbeitet, setArbeitet] = createSignal(false);
  api<{ standorte: Standort[] }>("/api/v1/standorte").then(
    (a) => a.ok && setStandorte(a.daten.standorte),
  );
  const entfernen = async (standort: Standort) => {
    const antwort = await api(`/api/v1/standorte/${standort.standortId}`, { method: "DELETE" });
    if (antwort.ok)
      setStandorte((liste) => liste.filter((s) => s.standortId !== standort.standortId));
  };
  const weiter = () => (standorte().length > 0 ? props.weiter() : setFehler(m.standort_fehlt()));
  return (
    <>
      <SchrittKopf id="schritt-titel" titel={m.standorte_titel()} text={m.standorte_text()} />
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
                  onClick={() => entfernen(standort)}
                >
                  <Icon icon={Trash2} />
                </Button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <NeuerStandort
        land={props.land}
        arbeitet={arbeitet()}
        setzeArbeitet={setArbeitet}
        angelegt={(neu) => {
          setFehler("");
          setStandorte((liste) => [...liste, neu]);
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
