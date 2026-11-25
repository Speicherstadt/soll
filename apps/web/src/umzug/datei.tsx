import { type LeseFehler, WERKZEUGE } from "@soll/import";
import { createUniqueId, For, Match, Show, Switch } from "solid-js";
import { m } from "../paraglide/messages.js";
import { AbrufFormular } from "./abruf.tsx";
import { KimaiAbrufFormular } from "./abruf-kimai.tsx";
import { SchichtplanerAbrufFormular } from "./abruf-schichtplaner.tsx";
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

const Dateiwahl = (props: {
  quelle: string;
  gewaehlt: (datei: Datei) => void;
  zuGross: () => void;
}) => {
  const id = createUniqueId();
  const waehlen = async (datei: File | undefined) => {
    if (!datei) return;
    if (datei.size > MAX_BYTES) return props.zuGross();
    const bytes = new Uint8Array(await datei.arrayBuffer());
    props.gewaehlt({ name: datei.name, inhalt: base64Von(bytes) });
  };
  return (
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
  );
};

type Weg = "datei" | "api";

/** The shift planners, which share one form (S-706) */
const SCHICHTPLANER = ["papershift", "planday", "crewmeister"] as const;

/** File or API, for a tool that offers both (S-703); Kimai has only the API (S-705) */
const Wegwahl = (props: { weg: Weg; setWeg: (weg: Weg) => void }) => (
  <fieldset class="flex flex-wrap gap-2">
    <legend class="mb-2 font-medium">{m.umzug_weg_frage()}</legend>
    <For each={[["datei", m.umzug_weg_datei()] as const, ["api", m.umzug_weg_api()] as const]}>
      {([weg, name]) => (
        <label class="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3">
          <input
            type="radio"
            name="weg"
            value={weg}
            checked={props.weg === weg}
            onChange={() => props.setWeg(weg)}
          />
          {name}
        </label>
      )}
    </For>
  </fieldset>
);

/** Step 2: the exported file or a fetch over the API; the server reads it and answers with the preview */
export const DateiSchritt = (props: {
  quelle: string;
  vorschau: Vorschau | null;
  wege: readonly Weg[];
  weg: Weg;
  setWeg: (weg: Weg) => void;
  arbeitet: boolean;
  gewaehlt: (datei: Datei) => void;
  abrufen: (abruf: Abruf) => Promise<boolean>;
  zuGross: () => void;
}) => {
  return (
    <div class="flex flex-col gap-4">
      <Show when={props.wege.length > 1}>
        <Wegwahl weg={props.weg} setWeg={props.setWeg} />
      </Show>
      <Show
        when={props.weg === "api"}
        fallback={
          <Dateiwahl quelle={props.quelle} gewaehlt={props.gewaehlt} zuGross={props.zuGross} />
        }
      >
        <Switch fallback={<AbrufFormular arbeitet={props.arbeitet} abrufen={props.abrufen} />}>
          <Match when={props.quelle === "kimai"}>
            <KimaiAbrufFormular arbeitet={props.arbeitet} abrufen={props.abrufen} />
          </Match>
          <Match when={SCHICHTPLANER.find((id) => id === props.quelle)}>
            {(werkzeug) => (
              <SchichtplanerAbrufFormular
                werkzeug={werkzeug()}
                arbeitet={props.arbeitet}
                abrufen={props.abrufen}
              />
            )}
          </Match>
        </Switch>
      </Show>
      <Show when={props.vorschau}>
        {(vorschau) => (
          <>
            <p role="status">
              {m.umzug_gelesen({
                zeiten: vorschau().anzahl.zeiten,
                abwesenheiten: vorschau().anzahl.abwesenheiten,
                kunden: vorschau().anzahl.kunden,
                projekte: vorschau().anzahl.projekte,
                taetigkeiten: vorschau().anzahl.taetigkeiten,
              })}
            </p>
            <Show when={vorschau().anzahl.schichten > 0}>
              <p>{m.umzug_gelesen_schichten({ schichten: vorschau().anzahl.schichten })}</p>
            </Show>
            <Lesefehler fehler={vorschau().lesefehler} />
          </>
        )}
      </Show>
    </div>
  );
};
