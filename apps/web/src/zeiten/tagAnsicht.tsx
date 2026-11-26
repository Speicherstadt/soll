import type { Tagesstand } from "@soll/arbeitszeit";
import { Button, Icon } from "@soll/ui";
import { Plus } from "lucide";
import { createSignal, Show } from "solid-js";
import { dauerText } from "../einrichtung/werte.ts";
import { LueckenKarte } from "../offline/hinweise.tsx";
import { m } from "../paraglide/messages.js";
import { BefundListe } from "./befunde.tsx";
import { type Korrektur, KorrekturDialog } from "./korrektur.tsx";
import { AenderungListe, StempelListe } from "./stempelListe.tsx";
import { uhrzeitText } from "./text.ts";
import type { TagAnsicht as Ansicht } from "./typen.ts";

const Wert = (props: { name: string; wert: string }) => (
  <div class="flex flex-col gap-0.5">
    <dt class="text-[12px] text-muted-foreground">{props.name}</dt>
    <dd class="font-mono text-[15px] tabular-nums">{props.wert}</dd>
  </div>
);

/** A day in figures: begin, end, target, actual and break */
const Summen = (props: { stand: Tagesstand; sollMinuten: number | null }) => (
  <div class="flex flex-col gap-2 rounded-xl border border-border p-4">
    <dl class="grid grid-cols-3 gap-3 sm:grid-cols-5">
      <Wert
        name={m.tag_beginn()}
        wert={props.stand.beginn === null ? "–" : uhrzeitText(props.stand.beginn)}
      />
      <Wert
        name={m.tag_ende()}
        wert={props.stand.ende === null ? "–" : uhrzeitText(props.stand.ende)}
      />
      <Wert
        name={m.tag_soll()}
        wert={props.sollMinuten === null ? m.soll_nicht_hinterlegt() : dauerText(props.sollMinuten)}
      />
      <Wert name={m.tag_ist()} wert={dauerText(props.stand.istMinuten)} />
      <Wert name={m.tag_pause()} wert={dauerText(props.stand.pausenMinuten)} />
    </dl>
    <Show when={props.stand.pausenabzugMinuten > 0}>
      <p class="text-[12px] text-muted-foreground">
        {m.pausenabzug_hinweis({ minuten: String(props.stand.pausenabzugMinuten) })}
      </p>
    </Show>
  </div>
);

/**
 * The times of one day of one person: figures, findings, the stamps with their corrections and every
 * change, for the person and whoever may see them
 */
export const TagAnsicht = (props: {
  ansicht: Ansicht;
  stand: Tagesstand;
  darfKorrigieren: boolean;
}) => {
  const [korrektur, setKorrektur] = createSignal<Korrektur | null>(null);
  return (
    <div class="flex flex-col gap-5">
      <Summen stand={props.stand} sollMinuten={props.ansicht.sollMinuten} />
      <BefundListe befunde={props.stand.befunde} nichtHinterlegt={props.stand.nichtHinterlegt} />
      <LueckenKarte luecken={props.ansicht.luecken} />
      <StempelListe
        stempelungen={props.ansicht.stempelungen}
        darfKorrigieren={props.darfKorrigieren}
        onAendern={(stempel) => setKorrektur({ modus: "aendern", stempel })}
        onEntfernen={(stempel) => setKorrektur({ modus: "entfernen", stempel })}
      />
      <Show when={props.darfKorrigieren}>
        <Button
          variant="outline"
          class="self-start"
          onClick={() =>
            setKorrektur({
              modus: "nachtragen",
              tag: props.ansicht.tag,
              nutzerId: props.ansicht.nutzerId,
            })
          }
        >
          <Icon icon={Plus} />
          {m.nachtragen()}
        </Button>
      </Show>
      <AenderungListe aenderungen={props.ansicht.aenderungen} />
      <Show when={korrektur()}>
        {(aktuell) => (
          <KorrekturDialog korrektur={aktuell()} onSchliessen={() => setKorrektur(null)} />
        )}
      </Show>
    </div>
  );
};
