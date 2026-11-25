import { SOLL_CSV_VORLAGE, WERKZEUGE } from "@soll/import";
import { Button } from "@soll/ui";
import { For, Show } from "solid-js";
import { PFAD } from "../abfragen/schluessel.ts";
import { m } from "../paraglide/messages.js";
import { ANLEITUNG } from "./texte.ts";

/** The template of the Soll-CSV as a download, made in the browser */
const vorlageLaden = () => {
  // a byte order mark, so Excel opens the umlauts as UTF-8
  const url = URL.createObjectURL(
    new Blob([`﻿${SOLL_CSV_VORLAGE}`], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "soll-vorlage.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** The templates the server makes for a tool (S-702), as links to download */
const Vorlagen = (props: { quelle: string }) => (
  <ul class="flex flex-wrap gap-x-4 gap-y-2">
    <For each={WERKZEUGE.find((w) => w.id === props.quelle)?.vorlagen ?? []}>
      {(datei) => (
        <li>
          <a
            href={`${PFAD.importe}/vorlagen/${datei}`}
            download={datei}
            class="underline underline-offset-2"
          >
            {m.umzug_vorlage_datei({ datei })}
          </a>
        </li>
      )}
    </For>
  </ul>
);

/** Step 1: the tool the data comes from, and how to export it there */
export const WerkzeugSchritt = (props: { quelle: string; waehlen: (quelle: string) => void }) => (
  <div class="flex flex-col gap-4">
    <fieldset class="flex flex-col gap-2">
      <legend class="mb-2 font-medium">{m.umzug_werkzeug_frage()}</legend>
      <For each={WERKZEUGE}>
        {(quelle) => (
          <label class="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3">
            <input
              type="radio"
              name="quelle"
              value={quelle.id}
              checked={props.quelle === quelle.id}
              onChange={() => props.waehlen(quelle.id)}
            />
            {quelle.name}
          </label>
        )}
      </For>
    </fieldset>
    <Show when={ANLEITUNG[props.quelle]}>
      {(anleitung) => (
        <section aria-labelledby="anleitung-titel" class="flex flex-col gap-2">
          <h3 id="anleitung-titel" class="font-semibold">
            {m.umzug_anleitung_titel()}
          </h3>
          <p class="text-muted-foreground">{anleitung()()}</p>
          <Show when={props.quelle === "soll-csv"}>
            <Button variant="outline" class="self-start" onClick={vorlageLaden}>
              {m.umzug_vorlage()}
            </Button>
          </Show>
          <Vorlagen quelle={props.quelle} />
        </section>
      )}
    </Show>
  </div>
);
