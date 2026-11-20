import type { Striche } from "@soll/arbeitszeit";
import { Button, Input } from "@soll/ui";
import { createSignal, createUniqueId, For } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { nachweisUnterschreiben } from "./quelle.ts";
import { nachweisFehler } from "./text.ts";
import type { NachweisKopf, NachweisWahl, Vorschau } from "./typen.ts";
import { UnterschriftFlaeche } from "./unterschrift.tsx";

/**
 * The customer signs on the phone: the remark (material, notes), the name and the signature drawn on
 * the surface; the report then stands in the list, and the form starts over for the next one
 */
export const Unterschreiben = (props: {
  wahl: NachweisWahl;
  vorschau: Vorschau;
  onUnterschrieben: (nachweis: NachweisKopf) => void;
}) => {
  const id = createUniqueId();
  const [striche, setStriche] = createSignal<Striche>([]);
  const [fehler, setFehler] = createSignal("");
  const [runde, setRunde] = createSignal(0);
  const senden = nachweisUnterschreiben();
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const daten = new FormData(form);
    const unterzeichner = String(daten.get("unterzeichner") ?? "").trim();
    if (!unterzeichner || !striche().some((strich) => strich.length > 1))
      return setFehler(m.nachweis_fehler_unterschrift());
    const antwort = await senden.unterschreiben({
      ...props.wahl,
      stand: props.vorschau.stand,
      bemerkung: String(daten.get("bemerkung") ?? "").trim(),
      unterzeichner,
      unterschrift: striche(),
    });
    if (!antwort.ok) return setFehler(nachweisFehler(antwort.fehler));
    setFehler("");
    form.reset();
    setStriche([]);
    // a new surface for the next report
    setRunde((zahl) => zahl + 1);
    props.onUnterschrieben(antwort.daten);
  };
  return (
    <form aria-label={m.nachweis_unterschreiben()} class="flex flex-col gap-4" onSubmit={absenden}>
      <div class="flex flex-col gap-1.5">
        <label for={`${id}-bemerkung`} class="font-medium">
          {m.nachweis_bemerkung()}
        </label>
        <textarea
          id={`${id}-bemerkung`}
          name="bemerkung"
          rows={3}
          maxlength={2000}
          aria-describedby={`${id}-bemerkung-hinweis`}
          class={[feld, "h-auto py-1.5"]}
        />
        <p id={`${id}-bemerkung-hinweis`} class="text-[12px] text-muted-foreground">
          {m.nachweis_bemerkung_hinweis()}
        </p>
      </div>
      <Input
        label={m.nachweis_unterzeichner()}
        name="unterzeichner"
        maxlength={100}
        autocomplete="off"
        class="md:w-72"
      />
      {/* keyed by the round: a new report gets an empty surface */}
      <For each={[runde()]}>
        {() => (
          <UnterschriftFlaeche
            onAendern={(neu) => {
              // a new stroke answers the request to sign
              setFehler("");
              setStriche(neu);
            }}
          />
        )}
      </For>
      <Fehler text={fehler()} />
      <Button type="submit" class="self-start" disabled={senden.arbeitet()}>
        {m.nachweis_unterschreiben()}
      </Button>
    </form>
  );
};
