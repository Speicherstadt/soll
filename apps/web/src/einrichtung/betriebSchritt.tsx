import { type Fragen, LAENDER, MODULE, type Module } from "@soll/arbeitszeit";
import { Input } from "@soll/ui";
import { createSignal, createUniqueId, For, Show, untrack } from "solid-js";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { sitzungNeu } from "../sitzung/sitzung.ts";
import type { Betrieb } from "../sitzung/ziel.ts";
import { Fuss, SchrittKopf } from "./geruest.tsx";
import { LAND_NAMEN, MODUL_NAMEN } from "./namen.ts";
import { feld } from "./stil.ts";
import { slugAus } from "./werte.ts";

const FRAGEN: { id: keyof Fragen; text: () => string }[] = [
  { id: "beschaeftigte", text: m.frage_beschaeftigte },
  { id: "schichten", text: m.frage_schichten },
  { id: "kunden", text: m.frage_kunden },
  { id: "stempelort", text: m.frage_stempelort },
];

export type Antworten = Partial<Fragen>;

const zufall = () => crypto.getRandomValues(new Uint32Array(1))[0]?.toString(36) ?? "0";

/**
 * Creates the business in Better Auth (its organization, with the creator as owner) if the account
 * has none yet, then saves name, Land and the answers
 */
const speichern = async (
  betrieb: Betrieb | null,
  angaben: { name: string; land: string; fragen: Fragen },
) => {
  if (!betrieb) {
    const neu = await api("/api/auth/organization/create", {
      body: { name: angaben.name, slug: slugAus(angaben.name, zufall()) },
    });
    if (!neu.ok) return neu;
  }
  return api("/api/v1/einrichtung/betrieb", { method: "PUT", body: angaben });
};

const Frage = (props: {
  frage: (typeof FRAGEN)[number];
  antworten: Antworten;
  setze: (wert: boolean) => void;
}) => (
  <fieldset class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border px-3 py-2.5">
    <legend class="float-left">{props.frage.text()}</legend>
    <div class="flex gap-4">
      <For each={[true, false]}>
        {(wert) => (
          <label class="flex min-h-7 items-center gap-1.5">
            <input
              type="radio"
              name={props.frage.id}
              required
              checked={props.antworten[props.frage.id] === wert}
              onChange={() => props.setze(wert)}
            />
            {wert ? m.ja() : m.nein()}
          </label>
        )}
      </For>
    </div>
  </fieldset>
);

const ModulZeile = (props: { module: Module }) => (
  <p class="flex flex-wrap items-center gap-1.5">
    <span class="text-muted-foreground">{m.einrichtung_module()}</span>
    <For each={MODULE.filter((modul) => props.module[modul])}>
      {(modul) => (
        <span class="rounded-full bg-accent px-2 py-0.5">
          {modul === "arbeitszeit" ? m.modul_arbeitszeit_pflicht() : MODUL_NAMEN[modul]()}
        </span>
      )}
    </For>
    <span class="text-muted-foreground">{m.einrichtung_module_spaeter()}</span>
  </p>
);

/** Step 1: the business, its Land, and the four questions that switch the modules */
export const BetriebSchritt = (props: {
  betrieb: Betrieb | null;
  antworten: Antworten;
  setzeAntworten: (antworten: Antworten) => void;
  module: Module;
  nummer: number;
  anzahl: number;
  weiter: () => void;
}) => {
  const formId = createUniqueId();
  // what the server has, as the fields' first value: a bound value would overwrite what is typed
  const anfang = untrack(() => ({
    name: props.betrieb?.name ?? "",
    land: props.betrieb?.land ?? "",
  }));
  const landId = createUniqueId();
  const [fehler, setFehler] = createSignal("");
  const [arbeitet, setArbeitet] = createSignal(false);
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const daten = new FormData(event.currentTarget as HTMLFormElement);
    const fragen = {
      beschaeftigte: false,
      schichten: false,
      kunden: false,
      stempelort: false,
      ...props.antworten,
    };
    setArbeitet(true);
    const name = String(daten.get("name")).trim();
    const antwort = await speichern(props.betrieb, {
      name,
      land: String(daten.get("land")),
      fragen,
    });
    // the business may exist now even if saving failed: asked again, a retry creates no second one
    await sitzungNeu();
    setArbeitet(false);
    if (!antwort.ok)
      return setFehler(
        antwort.fehler === "arbeitszeit_pflicht"
          ? m.fehler_arbeitszeit_pflicht()
          : m.fehler_speichern(),
      );
    props.weiter();
  };
  return (
    <>
      <SchrittKopf id="schritt-titel" titel={m.betrieb_titel()} text={m.betrieb_text()} />
      <form id={formId} class="flex flex-col gap-4" onSubmit={absenden}>
        <Input label={m.betrieb_name()} name="name" required maxlength={100} value={anfang.name} />
        <div class="flex flex-col gap-1.5">
          <label for={landId} class="font-medium">
            {m.betrieb_land()}
          </label>
          <select id={landId} name="land" required class={feld} value={anfang.land}>
            <option value="" disabled>
              {m.betrieb_land_waehlen()}
            </option>
            <For each={LAENDER}>{(land) => <option value={land}>{LAND_NAMEN[land]()}</option>}</For>
          </select>
        </div>
        <div class="flex flex-col gap-2.5">
          <span class="font-medium">{m.fragen_titel()}</span>
          <Frage
            frage={FRAGEN[0] as (typeof FRAGEN)[number]}
            antworten={props.antworten}
            setze={(wert) => props.setzeAntworten({ ...props.antworten, beschaeftigte: wert })}
          />
          <Show when={props.antworten.beschaeftigte !== false}>
            <For each={FRAGEN.slice(1)}>
              {(frage) => (
                <Frage
                  frage={frage}
                  antworten={props.antworten}
                  setze={(wert) => props.setzeAntworten({ ...props.antworten, [frage.id]: wert })}
                />
              )}
            </For>
          </Show>
          <ModulZeile module={props.module} />
        </div>
        <Fehler text={fehler()} />
      </form>
      <Fuss nummer={props.nummer} anzahl={props.anzahl} form={formId} arbeitet={arbeitet()} />
    </>
  );
};
