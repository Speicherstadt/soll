import type { Tagesstand } from "@soll/arbeitszeit";
import { Badge, Button, Icon } from "@soll/ui";
import { Plus } from "lucide";
import { createSignal, Show } from "solid-js";
import { dauerText } from "../einrichtung/werte.ts";
import { saldoText } from "../monat/zeilen.ts";
import { LueckenKarte } from "../offline/hinweise.tsx";
import { m } from "../paraglide/messages.js";
import { BefundListe } from "./befunde.tsx";
import { type Korrektur, KorrekturDialog } from "./korrektur.tsx";
import { AenderungListe, StempelListe } from "./stempelListe.tsx";
import { uhrzeitText } from "./text.ts";
import type { TagAnsicht as Ansicht } from "./typen.ts";
import { TagesZeitstrahl } from "./zeitstrahl.tsx";

const KpiKarte = (props: { name: string; wert: string }) => (
  <div class="flex flex-col justify-between gap-1 rounded-xl border border-border bg-background p-4">
    <dt class="text-[12px] text-muted-foreground">{props.name}</dt>
    <dd class="font-mono font-semibold text-[22px] tabular-nums leading-tight">{props.wert}</dd>
  </div>
);

/** A day in visual KPI cards: actual time with target delta & progress, target, span, and break */
const Summen = (props: { stand: Tagesstand; sollMinuten: number | null }) => {
  const saldo = () =>
    props.sollMinuten === null ? null : props.stand.istMinuten - props.sollMinuten;
  const anteil = () => {
    const soll = props.sollMinuten;
    if (soll === null || soll <= 0) return null;
    return Math.min(100, Math.round((props.stand.istMinuten / soll) * 100));
  };
  const zeitraum = () => {
    const von = props.stand.beginn === null ? "–" : uhrzeitText(props.stand.beginn);
    const bis = props.stand.ende === null ? "–" : uhrzeitText(props.stand.ende);
    return props.stand.beginn === null && props.stand.ende === null ? "–" : `${von} – ${bis}`;
  };
  return (
    <div class="flex flex-col gap-2">
      <dl class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="flex flex-col justify-between gap-2 rounded-xl border border-border bg-background p-4">
          <dt class="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
            <span>{m.tag_ist()}</span>
            <Show when={saldo() !== null}>
              <Badge ton={(saldo() ?? 0) >= 0 ? "success" : "warning"}>
                {saldoText(saldo() ?? 0)}
              </Badge>
            </Show>
          </dt>
          <dd class="flex flex-col gap-2">
            <span class="font-mono font-semibold text-[22px] tabular-nums leading-tight">
              {dauerText(props.stand.istMinuten)}
            </span>
            <Show when={anteil() !== null}>
              <div aria-hidden="true" class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  class={[
                    "h-full rounded-full",
                    props.stand.istMinuten > 600
                      ? "bg-warning"
                      : (saldo() ?? 0) >= 0
                        ? "bg-success"
                        : "bg-primary",
                  ]}
                  style={{ width: `${anteil() ?? 0}%` }}
                />
              </div>
            </Show>
          </dd>
        </div>
        <KpiKarte
          name={m.tag_soll()}
          wert={
            props.sollMinuten === null ? m.soll_nicht_hinterlegt() : dauerText(props.sollMinuten)
          }
        />
        <KpiKarte name={m.tag_zeitraum()} wert={zeitraum()} />
        <KpiKarte name={m.tag_pause()} wert={dauerText(props.stand.pausenMinuten)} />
      </dl>
      <Show when={props.stand.pausenabzugMinuten > 0}>
        <p class="text-[12px] text-muted-foreground">
          {m.pausenabzug_hinweis({ minuten: String(props.stand.pausenabzugMinuten) })}
        </p>
      </Show>
    </div>
  );
};

/**
 * The times of one day of one person: visual KPI cards, interactive day timeline, and a 2-column
 * layout on desktop with stamps/changes beside findings.
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
      <TagesZeitstrahl stempelungen={props.ansicht.stempelungen} jetzt={props.ansicht.jetzt} />
      <LueckenKarte luecken={props.ansicht.luecken} />
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <div class="flex min-w-0 flex-col gap-4">
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
        </div>
        <div class="min-w-0 rounded-xl border border-border bg-background p-4">
          <BefundListe
            befunde={props.stand.befunde}
            nichtHinterlegt={props.stand.nichtHinterlegt}
          />
        </div>
      </div>
      <Show when={korrektur()}>
        {(aktuell) => (
          <KorrekturDialog korrektur={aktuell()} onSchliessen={() => setKorrektur(null)} />
        )}
      </Show>
    </div>
  );
};
