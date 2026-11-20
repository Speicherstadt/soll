import { CSV_ROLLEN, type CsvFehler, type CsvRolle, mitarbeiterAusCsv } from "@soll/import";
import { Button, Icon, Input } from "@soll/ui";
import { Trash2 } from "lucide";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Fuss, SchrittKopf } from "./geruest.tsx";
import { ROLLEN_NAMEN } from "./namen.ts";
import { feld } from "./stil.ts";

export type Person = { name: string; rolle: CsvRolle };

const fehlerText = (fehler: CsvFehler): string => {
  if (fehler.grund === "rolle_unbekannt")
    return m.csv_rolle_unbekannt({ zeile: fehler.zeile, wert: fehler.wert });
  const texte = {
    kein_kopf: m.csv_kein_kopf,
    zu_viele: m.csv_zu_viele,
    unlesbar: m.csv_unlesbar,
    name_fehlt: m.csv_name_fehlt,
    name_zu_lang: m.csv_name_zu_lang,
  };
  return texte[fehler.grund]({ zeile: fehler.zeile });
};

/** A spreadsheet as a file or pasted text: what it reads joins the list, what it cannot is named by line */
const CsvEinlesen = (props: { gelesen: (personen: Person[]) => void }) => {
  const dateiId = createUniqueId();
  const textId = createUniqueId();
  const [fehler, setFehler] = createSignal<CsvFehler[]>([]);
  const [text, setText] = createSignal("");
  const lesen = (inhalt: string) => {
    const ergebnis = mitarbeiterAusCsv(inhalt);
    setFehler(ergebnis.fehler);
    props.gelesen(ergebnis.personen.map(({ name, rolle }) => ({ name, rolle })));
  };
  return (
    <div class="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div class="flex flex-col gap-1.5">
        <label for={dateiId} class="font-medium">
          {m.csv_datei()}
        </label>
        <input
          id={dateiId}
          type="file"
          accept=".csv,text/csv,text/plain"
          class="text-muted-foreground file:me-3 file:h-9 file:rounded-sm file:border file:border-border file:bg-background file:px-3 file:text-foreground"
          onChange={async (event) => {
            const datei = event.currentTarget.files?.[0];
            if (datei) lesen(await datei.text());
          }}
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <label for={textId} class="font-medium">
          {m.csv_text()}
        </label>
        <textarea
          id={textId}
          rows={4}
          class={`${feld} h-auto py-1.5 font-mono text-[12px]`}
          value={text()}
          onInput={(event) => setText(event.currentTarget.value)}
        />
        <Button variant="outline" class="self-start" onClick={() => lesen(text())}>
          {m.csv_uebernehmen()}
        </Button>
      </div>
      <Show when={fehler().length > 0}>
        <ul role="alert" class="flex flex-col gap-1 text-danger">
          <For each={fehler()}>{(f) => <li>{fehlerText(f)}</li>}</For>
        </ul>
      </Show>
    </div>
  );
};

/** One person by hand: a name and a role */
const Einzeln = (props: { hinzu: (person: Person) => void }) => {
  const rolleId = createUniqueId();
  const absenden = (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const daten = new FormData(form);
    const name = String(daten.get("name")).trim();
    // the server refuses a list with a blank name whole (min 1), so none joins it
    if (!name) return;
    props.hinzu({ name, rolle: String(daten.get("rolle")) as CsvRolle });
    form.reset();
  };
  return (
    <form class="flex flex-wrap items-end gap-3" onSubmit={absenden}>
      <Input
        label={m.person_name()}
        name="name"
        required
        pattern=".*\S.*"
        maxlength={100}
        class="min-w-48 flex-1"
      />
      <div class="flex min-w-40 flex-col gap-1.5">
        <label for={rolleId} class="font-medium">
          {m.person_rolle()}
        </label>
        <select id={rolleId} name="rolle" class={feld} value="mitarbeiter">
          <For each={CSV_ROLLEN}>
            {(rolle) => <option value={rolle}>{ROLLEN_NAMEN[rolle]()}</option>}
          </For>
        </select>
      </div>
      <Button type="submit" variant="outline">
        {m.person_hinzufuegen()}
      </Button>
    </form>
  );
};

/** Step 4: the people of the business, from a CSV file or one by one; invited in the next step */
export const MitarbeiterSchritt = (props: {
  personen: Person[];
  setzePersonen: (personen: Person[]) => void;
  nummer: number;
  anzahl: number;
  zurueck?: (() => void) | undefined;
  weiter: () => void;
}) => (
  <>
    <SchrittKopf id="schritt-titel" titel={m.mitarbeiter_titel()} text={m.mitarbeiter_text()} />
    <CsvEinlesen gelesen={(neu) => props.setzePersonen([...props.personen, ...neu])} />
    <Einzeln hinzu={(neu) => props.setzePersonen([...props.personen, neu])} />
    <Show
      when={props.personen.length > 0}
      fallback={<p class="text-muted-foreground">{m.mitarbeiter_leer()}</p>}
    >
      <ul
        aria-label={m.mitarbeiter_liste()}
        class="flex flex-col divide-y divide-border rounded-lg border border-border"
      >
        <For each={props.personen}>
          {(person, index) => (
            <li class="flex items-center justify-between gap-3 px-3 py-1.5">
              <span>
                {person.name}{" "}
                <span class="text-muted-foreground">· {ROLLEN_NAMEN[person.rolle]()}</span>
              </span>
              <Button
                variant="icon"
                aria-label={m.person_entfernen({ name: person.name })}
                onClick={() => props.setzePersonen(props.personen.filter((_, i) => i !== index()))}
              >
                <Icon icon={Trash2} />
              </Button>
            </li>
          )}
        </For>
      </ul>
    </Show>
    <Fuss
      nummer={props.nummer}
      anzahl={props.anzahl}
      zurueck={props.zurueck}
      weiter={props.weiter}
    />
  </>
);
