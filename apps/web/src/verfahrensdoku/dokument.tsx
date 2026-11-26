import { Badge } from "@soll/ui";
import { createUniqueId, For, Show } from "solid-js";
import { PFAD } from "../abfragen/schluessel.ts";
import { hauptLink, knopfLink } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import type { Abschnitt, Dokument } from "./typen.ts";

/** The download of the document in a format, as the server names the file */
const datei = (format: "pdf" | "md") => `${PFAD.verfahrensdoku}/datei?format=${format}`;

/** Stand, completeness and the downloads; the PDF is the main action of the page */
export const DokumentKopf = (props: { dokument: Dokument }) => (
  <div class="flex flex-col gap-3">
    <p class="text-muted-foreground">{m.verfahrensdoku_text()}</p>
    <div class="flex flex-wrap items-center gap-2">
      <span class="tabular-nums">
        {m.verfahrensdoku_stand({
          datum: props.dokument.stand.datum,
          version: props.dokument.stand.version,
        })}
      </span>
      <Show
        when={props.dokument.vollstaendig}
        fallback={
          <Badge ton="warning">
            {m.verfahrensdoku_unvollstaendig({ anzahl: props.dokument.luecken })}
          </Badge>
        }
      >
        <Badge ton="success">{m.verfahrensdoku_vollstaendig()}</Badge>
      </Show>
    </div>
    <div class="flex flex-wrap gap-2">
      <a href={datei("pdf")} download class={hauptLink}>
        {m.verfahrensdoku_pdf()}
      </a>
      <a href={datei("md")} download class={knopfLink}>
        {m.verfahrensdoku_markdown()}
      </a>
    </div>
  </div>
);

/**
 * One section as the document holds it. Its text is German in every language: the document is for
 * the German authorities, as the PDF is.
 */
const AbschnittAnsicht = (props: { abschnitt: Abschnitt }) => (
  <section lang="de" class="flex min-w-0 flex-col gap-2">
    <h3 class="font-semibold">{props.abschnitt.titel}</h3>
    <For each={props.abschnitt.absaetze}>
      {(absatz) => <p class="whitespace-pre-line break-words">{absatz}</p>}
    </For>
    <Show when={props.abschnitt.liste}>
      {(liste) => (
        <ul class="list-disc ps-5">
          <For each={liste()}>
            {(eintrag) => <li class="whitespace-pre-line break-words">{eintrag}</li>}
          </For>
        </ul>
      )}
    </Show>
    <Show when={props.abschnitt.luecken}>
      {(luecken) => (
        <ul class="flex flex-col gap-1">
          <For each={luecken()}>
            {(luecke) => (
              <li class="flex items-start gap-2">
                <Badge ton="warning">{m.verfahrensdoku_fehlt()}</Badge>
                <span class="min-w-0 break-words">{luecke}</span>
              </li>
            )}
          </For>
        </ul>
      )}
    </Show>
  </section>
);

/** The whole document below the form, as the downloads carry it */
export const DokumentAnsicht = (props: { dokument: Dokument }) => {
  const id = createUniqueId();
  return (
    <section aria-labelledby={`${id}-titel`} class="flex min-w-0 max-w-3xl flex-col gap-4">
      <h2 id={`${id}-titel`} class="font-semibold">
        {m.verfahrensdoku_dokument_titel()}
      </h2>
      <p lang="de" class="break-all text-[12px] text-muted-foreground">
        {props.dokument.stand.pruefwert ?? ""}
      </p>
      <For each={props.dokument.abschnitte}>
        {(abschnitt) => <AbschnittAnsicht abschnitt={abschnitt} />}
      </For>
    </section>
  );
};
