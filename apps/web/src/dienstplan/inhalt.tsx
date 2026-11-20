import type { Tag } from "@soll/arbeitszeit";
import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Leer } from "../rahmen/seite.tsx";
import { DeckungListe } from "./deckung.tsx";
import { VorlagenLeiste } from "./leiste.tsx";
import { type RasterProps, WochenRaster } from "./raster.tsx";
import { TagListe } from "./tagListe.tsx";

/**
 * The week below the head: the templates to drag, the grid at the desktop and one day at a time on a
 * phone (DESIGN.md, "Aufbau"), then the coverage of the need
 */
export const PlanInhalt = (props: RasterProps & { tag: Tag; onTag: (tag: Tag) => void }) => (
  <>
    <Show when={!props.planer && props.woche.schichten.length === 0}>
      <Leer text={m.plan_nichts_veroeffentlicht()} />
    </Show>
    <Show when={props.planer}>
      <VorlagenLeiste vorlagen={props.vorlagen} />
    </Show>
    <div class="max-md:hidden">
      <WochenRaster {...props} />
    </div>
    <div class="md:hidden">
      <TagListe
        woche={props.woche}
        vorlagen={props.vorlagen}
        planer={props.planer}
        tag={props.woche.tage.includes(props.tag) ? props.tag : (props.woche.tage[0] ?? props.tag)}
        onTag={props.onTag}
        onOeffnen={props.onOeffnen}
        onNeu={props.onNeu}
      />
    </div>
    <DeckungListe deckung={props.woche.deckung ?? []} />
  </>
);
