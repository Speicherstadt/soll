import { type Monat, plusMonate, tagInBerlin } from "@soll/arbeitszeit";
import { Button } from "@soll/ui";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { Auswahl } from "../monat/auswahl.tsx";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { herunterladen } from "./herunterladen.ts";
import { fehlendText } from "./texte.ts";
import type { Fehlend, Ziel } from "./typen.ts";

/** What is "nicht hinterlegt", one line each, as the server listed it */
const FehlendListe = (props: { fehlend: Fehlend[] }) => (
  <div role="alert" class="flex flex-col gap-1.5 rounded-lg border border-border p-3">
    <span class="font-semibold">{m.datev_fehlend_titel()}</span>
    <ul class="list-disc ps-5">
      <For each={props.fehlend}>{(f) => <li>{fehlendText(f)}</li>}</For>
    </ul>
  </div>
);

/**
 * The DATEV payroll export (S-308): month and payroll program, then the file; only closed months,
 * so the numbers do not change after the export. The page shows it to whoever may take it (owner,
 * payroll): the server answers everyone else with 403.
 */
export const DatevExport = () => {
  const id = createUniqueId();
  const [monat, setMonat] = createSignal<Monat>(
    plusMonate(tagInBerlin(Date.now()).slice(0, 7), -1),
  );
  const [ziel, setZiel] = createSignal<Ziel>("lodas");
  const [fehlend, setFehlend] = createSignal<Fehlend[]>([]);
  const [fehler, setFehler] = createSignal("");
  const [laeuft, setLaeuft] = createSignal(false);
  const laden = async () => {
    setLaeuft(true);
    const ergebnis = await herunterladen(monat(), ziel());
    setLaeuft(false);
    setFehlend(!ergebnis.ok && "fehlend" in ergebnis ? ergebnis.fehlend : []);
    setFehler(
      !ergebnis.ok && "grund" in ergebnis
        ? ergebnis.grund === "netz"
          ? m.fehler_netz()
          : m.fehler_speichern()
        : "",
    );
  };
  return (
    <section
      aria-labelledby={`${id}-titel`}
      class="flex h-full min-w-0 flex-col gap-4 rounded-xl border border-border bg-background p-5"
    >
      <h2 id={`${id}-titel`} class="font-semibold">
        {m.datev_titel()}
      </h2>
      <p class="text-muted-foreground">{m.datev_export_text()}</p>
      <div class="flex flex-wrap items-end gap-3">
        <Auswahl
          personen={[]}
          nutzerId={undefined}
          monat={monat()}
          onPerson={() => undefined}
          onMonat={setMonat}
        />
        <div class="flex min-w-48 flex-col gap-1.5">
          <label for={`${id}-ziel`} class="font-medium">
            {m.datev_ziel()}
          </label>
          <select
            id={`${id}-ziel`}
            class={feld}
            value={ziel()}
            onChange={(event) => setZiel(event.currentTarget.value as Ziel)}
          >
            <option value="lodas">{m.datev_ziel_lodas()}</option>
            <option value="lug">{m.datev_ziel_lug()}</option>
          </select>
        </div>
        <Button onClick={laden} disabled={laeuft()}>
          {m.datev_herunterladen()}
        </Button>
      </div>
      <Show when={fehlend().length > 0}>
        <FehlendListe fehlend={fehlend()} />
      </Show>
      <Fehler text={fehler()} />
    </section>
  );
};
