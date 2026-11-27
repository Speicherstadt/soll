import type { Tag } from "@soll/arbeitszeit";
import { Match, Show, Switch } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Leer } from "../rahmen/seite.tsx";
import { BefundListe } from "./befundListe.tsx";
import { DeckungListe } from "./deckung.tsx";
import type { PlanAnsicht } from "./farben.ts";
import { VorlagenLeiste } from "./leiste.tsx";
import { MonatsAnsicht } from "./monatsAnsicht.tsx";
import { type RasterProps, WochenRaster } from "./raster.tsx";
import { TagesAnsicht } from "./tagesAnsicht.tsx";
import { TagListe } from "./tagListe.tsx";

/**
 * The plan body below the head: Day timeline, Week matrix (with drag-and-drop templates on desktop
 * and day list on phone), or Month calendar, followed by findings and coverage when not in TV mode.
 */
export const PlanInhalt = (
  props: RasterProps & {
    tag: Tag;
    ansicht: PlanAnsicht;
    standortId: string;
    vollbild: boolean;
    onTag: (tag: Tag) => void;
    onTagAnsicht: (tag: Tag) => void;
  },
) => (
  <>
    <Show when={props.ansicht !== "monat" && !props.planer && props.woche.schichten.length === 0}>
      <Leer text={m.plan_nichts_veroeffentlicht()} />
    </Show>
    <Show when={props.planer && props.ansicht === "woche" && !props.vollbild}>
      <VorlagenLeiste vorlagen={props.vorlagen} />
    </Show>
    <Switch>
      <Match when={props.ansicht === "tag"}>
        <TagesAnsicht
          woche={props.woche}
          vorlagen={props.vorlagen}
          planer={props.planer && !props.vollbild}
          tag={props.tag}
          onTag={props.onTag}
          onOeffnen={props.onOeffnen}
          onNeu={props.onNeu}
        />
      </Match>
      <Match when={props.ansicht === "monat"}>
        <MonatsAnsicht
          standortId={props.standortId}
          tag={props.tag}
          personen={props.woche.personen}
          vorlagen={props.vorlagen}
          planer={props.planer && !props.vollbild}
          onOeffnen={props.onOeffnen}
          onTagOeffnen={props.onTagAnsicht}
        />
      </Match>
      <Match when={props.ansicht === "woche"}>
        <div class="max-md:hidden">
          <WochenRaster {...props} planer={props.planer && !props.vollbild} />
        </div>
        <div class="md:hidden">
          <TagListe
            woche={props.woche}
            vorlagen={props.vorlagen}
            planer={props.planer && !props.vollbild}
            tag={
              props.woche.tage.includes(props.tag) ? props.tag : (props.woche.tage[0] ?? props.tag)
            }
            onTag={props.onTag}
            onOeffnen={props.onOeffnen}
            onNeu={props.onNeu}
          />
        </div>
      </Match>
    </Switch>
    <Show when={!props.vollbild}>
      <div data-print-hidden="" class="flex flex-col gap-4">
        <Show when={props.woche.befunde}>
          {(befunde) => (
            <BefundListe
              befunde={befunde()}
              personen={props.woche.personen}
              tage={props.woche.tage}
            />
          )}
        </Show>
        <DeckungListe deckung={props.woche.deckung ?? []} />
      </div>
    </Show>
  </>
);
