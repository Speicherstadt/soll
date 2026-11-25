import { Button, Icon } from "@soll/ui";
import { X } from "lucide";
import { createSignal, createUniqueId, For, Show, untrack } from "solid-js";
import { aenderung } from "../abfragen/abfrage.ts";
import { alle, PFAD } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { angabenAus, eigenerName } from "./formular.ts";
import { type Angaben, EIGENE, FELDER, type Feld, LAENGE } from "./typen.ts";

const TEXTE: Record<Feld, { label: () => string; hinweis: () => string }> = {
  rechtsform: { label: m.verfahrensdoku_rechtsform, hinweis: m.verfahrensdoku_rechtsform_hinweis },
  anschrift: { label: m.verfahrensdoku_anschrift, hinweis: m.verfahrensdoku_anschrift_hinweis },
  verantwortlich: {
    label: m.verfahrensdoku_verantwortlich,
    hinweis: m.verfahrensdoku_verantwortlich_hinweis,
  },
  aufbewahrungsort: {
    label: m.verfahrensdoku_aufbewahrungsort,
    hinweis: m.verfahrensdoku_aufbewahrungsort_hinweis,
  },
  serverbetrieb: {
    label: m.verfahrensdoku_serverbetrieb,
    hinweis: m.verfahrensdoku_serverbetrieb_hinweis,
  },
  datensicherung: {
    label: m.verfahrensdoku_datensicherung,
    hinweis: m.verfahrensdoku_datensicherung_hinweis,
  },
  schluesselablage: {
    label: m.verfahrensdoku_schluesselablage,
    hinweis: m.verfahrensdoku_schluesselablage_hinweis,
  },
};

/** A text area with its label and hint, in the look of Input */
const Textfeld = (props: {
  id: string;
  name: string;
  label: string;
  hinweis?: string;
  wert: string;
  max: number;
  zeilen: number;
}) => (
  <div class="flex flex-col gap-1.5">
    <label for={props.id} class="font-medium">
      {props.label}
    </label>
    <textarea
      id={props.id}
      name={props.name}
      rows={props.zeilen}
      maxlength={props.max}
      aria-describedby={props.hinweis ? `${props.id}-hinweis` : undefined}
      class={`${feld} h-auto py-1.5`}
      value={props.wert}
    />
    <Show when={props.hinweis}>
      <p id={`${props.id}-hinweis`} class="text-[12px] text-muted-foreground">
        {props.hinweis}
      </p>
    </Show>
  </div>
);

type Zeile = { schluessel: number; titel: string; text: string };

/** The own sections: a title and a text each, added and removed in the form, saved with it */
const EigeneAbschnitte = (props: {
  id: string;
  zeilen: Zeile[];
  onNeu: () => void;
  onWeg: (schluessel: number) => void;
}) => (
  <fieldset class="flex flex-col gap-3">
    <legend class="mb-1 font-medium">{m.verfahrensdoku_eigene_titel()}</legend>
    <p class="text-[12px] text-muted-foreground">{m.verfahrensdoku_eigene_text()}</p>
    <For each={props.zeilen}>
      {(zeile, index) => (
        <div class="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div class="flex items-end gap-2">
            <div class="flex flex-1 flex-col gap-1.5">
              <label for={`${props.id}-${zeile.schluessel}-titel`} class="font-medium">
                {m.verfahrensdoku_abschnitt_titel({ nummer: index() + 1 })}
              </label>
              <input
                id={`${props.id}-${zeile.schluessel}-titel`}
                name={eigenerName("titel", zeile.schluessel)}
                maxlength={EIGENE.titel}
                class={feld}
                value={zeile.titel}
              />
            </div>
            <Button
              variant="icon"
              aria-label={m.verfahrensdoku_abschnitt_entfernen({ nummer: index() + 1 })}
              onClick={() => props.onWeg(zeile.schluessel)}
            >
              <Icon icon={X} />
            </Button>
          </div>
          <Textfeld
            id={`${props.id}-${zeile.schluessel}-text`}
            name={eigenerName("text", zeile.schluessel)}
            label={m.verfahrensdoku_abschnitt_text({ nummer: index() + 1 })}
            wert={zeile.text}
            max={EIGENE.text}
            zeilen={4}
          />
        </div>
      )}
    </For>
    <Show when={props.zeilen.length < EIGENE.anzahl}>
      <Button variant="outline" class="self-start" onClick={props.onNeu}>
        {m.verfahrensdoku_abschnitt_neu()}
      </Button>
    </Show>
  </fieldset>
);

/**
 * The statements only the business can make (S-902), saved at once through PUT; the document above
 * loads again with them. The form keeps what is typed: each field takes its saved value once.
 */
export const AngabenFormular = (props: { angaben: Angaben }) => {
  const id = createUniqueId();
  let naechste = 0;
  const zeile = (teil: { titel: string; text: string }): Zeile => ({
    schluessel: naechste++,
    ...teil,
  });
  const [zeilen, setZeilen] = createSignal(untrack(() => props.angaben.eigene.map(zeile)));
  const [fehler, setFehler] = createSignal("");
  const [gespeichert, setGespeichert] = createSignal(false);
  const speichern = aenderung(
    (body: Angaben) => api(`${PFAD.verfahrensdoku}/angaben`, { method: "PUT", body }),
    () => [alle(PFAD.verfahrensdoku)],
  );
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const antwort = await speichern.mutate(
      angabenAus(
        form,
        zeilen().map((z) => z.schluessel),
      ),
    );
    setGespeichert(antwort.ok);
    setFehler(antwort.ok ? "" : m.verfahrensdoku_fehler());
  };
  return (
    <section aria-labelledby={`${id}-titel`} class="flex max-w-2xl flex-col gap-3">
      <h2 id={`${id}-titel`} class="font-semibold">
        {m.verfahrensdoku_angaben_titel()}
      </h2>
      <p class="text-muted-foreground">{m.verfahrensdoku_angaben_text()}</p>
      <form class="flex flex-col gap-4" onSubmit={absenden}>
        <For each={FELDER}>
          {(name) => (
            <Textfeld
              id={`${id}-${name}`}
              name={name}
              label={TEXTE[name].label()}
              hinweis={TEXTE[name].hinweis()}
              wert={props.angaben[name]}
              max={LAENGE[name]}
              zeilen={name === "rechtsform" ? 1 : 3}
            />
          )}
        </For>
        <EigeneAbschnitte
          id={id}
          zeilen={zeilen()}
          onNeu={() => setZeilen((liste) => [...liste, zeile({ titel: "", text: "" })])}
          onWeg={(schluessel) =>
            setZeilen((liste) => liste.filter((z) => z.schluessel !== schluessel))
          }
        />
        <Fehler text={fehler()} />
        <Show when={gespeichert()}>
          <p role="status" class="text-success">
            {m.verfahrensdoku_gespeichert()}
          </p>
        </Show>
        <Button type="submit" variant="outline" class="self-start" disabled={speichern.isPending}>
          {m.verfahrensdoku_speichern()}
        </Button>
      </form>
    </section>
  );
};
