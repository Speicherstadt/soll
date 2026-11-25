import { type LeseFehler, WERKZEUGE } from "@soll/import";
import { createUniqueId, For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { AbrufFormular } from "./abruf.tsx";
import { lesefehlerText } from "./texte.ts";
import type { Abruf, Datei, Liste, Vorschau } from "./typen.ts";
import { base64Von } from "./zustand.ts";

/** The largest file the server takes (apps/server, modules/umzug/datei.ts) */
const MAX_BYTES = 5 * 1024 * 1024;

/** The lines the reader refused, each with its number and reason */
export const Lesefehler = (props: { fehler: Liste<LeseFehler> }) => (
  <Show when={props.fehler.anzahl > 0}>
    <section aria-labelledby="lesefehler-titel" class="flex flex-col gap-1.5">
      <h3 id="lesefehler-titel" class="font-semibold text-danger">
        {m.umzug_lesefehler_titel({ anzahl: props.fehler.anzahl })}
      </h3>
      <ul class="flex max-h-60 flex-col gap-1 overflow-y-auto">
        <For each={props.fehler.liste}>{(fehler) => <li>{lesefehlerText(fehler)}</li>}</For>
      </ul>
    </section>
  </Show>
);

/** What was read: the numbers of records and the lines refused */
const Gelesen = (props: { vorschau: Vorschau }) => (
  <>
    <p role="status">
      {m.umzug_gelesen({
        zeiten: props.vorschau.anzahl.zeiten,
        abwesenheiten: props.vorschau.anzahl.abwesenheiten,
        kunden: props.vorschau.anzahl.kunden,
        projekte: props.vorschau.anzahl.projekte,
      })}
    </p>
    <Lesefehler fehler={props.vorschau.lesefehler} />
  </>
);

type Props = {
  quelle: string;
  vorschau: Vorschau | null;
  gewaehlt: (datei: Datei) => void;
  zuGross: () => void;
  arbeitet: boolean;
  abrufen: (abruf: Abruf) => Promise<boolean>;
};

/** The file input for a tool whose export the owner uploads */
const DateiWahl = (props: Props) => {
  const id = createUniqueId();
  const waehlen = async (datei: File | undefined) => {
    if (!datei) return;
    if (datei.size > MAX_BYTES) return props.zuGross();
    const bytes = new Uint8Array(await datei.arrayBuffer());
    props.gewaehlt({ name: datei.name, inhalt: base64Von(bytes) });
  };
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label for={id} class="font-medium">
          {m.umzug_datei_waehlen()}
        </label>
        <input
          id={id}
          type="file"
          accept={(WERKZEUGE.find((w) => w.id === props.quelle)?.endungen ?? [".csv"]).join(",")}
          class="text-muted-foreground file:me-3 file:h-9 file:rounded-sm file:border file:border-border file:bg-background file:px-3 file:text-foreground"
          onChange={(event) => void waehlen(event.currentTarget.files?.[0])}
        />
      </div>
    </div>
  );
};

/**
 * Step 2: the exported file, or for a tool with an API the fetch (S-705); the server reads the file
 * and answers with the preview
 */
export const DateiSchritt = (props: Props) => (
  <div class="flex flex-col gap-4">
    <Show
      when={WERKZEUGE.find((w) => w.id === props.quelle)?.weg === "api"}
      fallback={<DateiWahl {...props} />}
    >
      <AbrufFormular arbeitet={props.arbeitet} abrufen={props.abrufen} />
    </Show>
    <Show when={props.vorschau}>{(vorschau) => <Gelesen vorschau={vorschau()} />}</Show>
  </div>
);
