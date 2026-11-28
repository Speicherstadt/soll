import type { Tag } from "@soll/arbeitszeit";
import { Button, cn, Icon } from "@soll/ui";
import { Plus } from "lucide";
import { createMemo, createSignal, For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { befundeDer } from "./befunde.ts";
import { Block, GRIFF_HINWEIS } from "./block.tsx";
import { type Zelle, zielNach } from "./tastatur.ts";
import { spanneText, tagDerZahl, tagLang, wochentagKurz } from "./text.ts";
import type { Schicht, Vorlage, Woche, Ziel } from "./typen.ts";
import { type Planzeile, planzeilen } from "./zeilen.ts";
import { type Abgelegt, abgelegt, ziehbar, zielSchluessel } from "./ziehen.ts";

export type RasterProps = {
  woche: Woche;
  vorlagen: readonly Vorlage[];
  planer: boolean;
  onOeffnen: (schicht: Schicht) => void;
  onNeu: (ziel: Ziel) => void;
  onAblegen: (was: Abgelegt, ziel: Ziel) => void;
  /** a polite announcement for screen readers (picked up, target, dropped) */
  ansagen: (text: string) => void;
};

const WOCHENENDE = new Set([5, 6]);

/**
 * The week grid at the desktop (DESIGN.md, "Dienstplan"): people as rows, days as columns, shifts as
 * blocks with time and role. Whoever plans drags a shift or a template onto a cell, or picks a shift
 * up with the keyboard at its handle and moves it with the arrows (ARIA Authoring Practices: a drag
 * needs a keyboard way too).
 */
export const WochenRaster = (props: RasterProps) => {
  const zeilen = createMemo(() => planzeilen(props.woche, props.planer));
  const [bewegt, setBewegt] = createSignal<{ schicht: Schicht; ziel: Zelle } | null>(null);
  const [ueber, setUeber] = createSignal<string | null>(null);
  const zielAus = (zelle: Zelle): Ziel => ({
    nutzerId: zeilen()[zelle.zeile]?.nutzerId ?? null,
    tag: props.woche.tage[zelle.spalte] ?? "",
  });
  const ortText = (zelle: Zelle) =>
    m.plan_ort({ name: zeilen()[zelle.zeile]?.name ?? "", tag: tagLang(zielAus(zelle).tag) });
  const griff = (schicht: Schicht, zelle: Zelle) => {
    const jetzt = bewegt();
    if (jetzt?.schicht.schichtId !== schicht.schichtId) {
      setBewegt({ schicht, ziel: zelle });
      return props.ansagen(m.plan_aufgenommen());
    }
    setBewegt(null);
    props.ansagen(m.plan_abgelegt({ ort: ortText(jetzt.ziel) }));
    props.onAblegen({ schicht }, zielAus(jetzt.ziel));
  };
  const taste = (event: KeyboardEvent) => {
    const jetzt = bewegt();
    if (!jetzt) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setBewegt(null);
      return props.ansagen(m.plan_abgebrochen());
    }
    const rtl = getComputedStyle(event.currentTarget as Element).direction === "rtl";
    const neu = zielNach(event.key, jetzt.ziel, zeilen().length, props.woche.tage.length, rtl);
    if (!neu) return;
    event.preventDefault();
    setBewegt({ ...jetzt, ziel: neu });
    props.ansagen(m.plan_ziel({ ort: ortText(neu) }));
  };
  const istZiel = (zelle: Zelle) => {
    const ziel = bewegt()?.ziel;
    return (
      (ziel?.zeile === zelle.zeile && ziel.spalte === zelle.spalte) ||
      ueber() === zielSchluessel(zielAus(zelle))
    );
  };
  return (
    <div
      tabindex={0}
      class="overflow-x-auto rounded-xl border border-border focus-visible:outline-2 focus-visible:outline-foreground"
    >
      <Show when={props.planer}>
        <p id={GRIFF_HINWEIS} class="sr-only">
          {m.plan_griff_hinweis()}
        </p>
      </Show>
      <table class="w-full min-w-[980px] table-fixed border-collapse">
        <caption class="sr-only">{m.plan_tabelle()}</caption>
        <thead>
          <tr class="border-border border-b">
            <th
              scope="col"
              class="w-[150px] px-3 py-2.5 text-start font-semibold text-muted-foreground"
            >
              {m.plan_person()}
            </th>
            <For each={props.woche.tage}>
              {(tag, spalte) => {
                const anzahl = () => props.woche.schichten.filter((s) => s.tag === tag).length;
                return (
                  <th
                    scope="col"
                    class={cn(
                      "px-2 py-2.5 text-start font-semibold",
                      WOCHENENDE.has(spalte()) && "bg-muted",
                    )}
                  >
                    <div class="flex items-center justify-between gap-1">
                      <span>
                        <span>{wochentagKurz(tag)}</span>{" "}
                        <span class="font-normal text-muted-foreground">{tagDerZahl(tag)}</span>
                      </span>
                      <Show when={anzahl() > 0}>
                        <span class="rounded-full bg-muted px-1.5 font-mono font-normal text-[11px] text-muted-foreground tabular-nums">
                          {anzahl()}
                        </span>
                      </Show>
                    </div>
                  </th>
                );
              }}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={zeilen()} keyed={(zeile) => zeile.nutzerId ?? ""}>
            {(zeile, index) => (
              <Zeile
                zeile={zeile()}
                index={index()}
                tage={props.woche.tage}
                raster={props}
                bewegt={bewegt()?.schicht.schichtId ?? null}
                istZiel={istZiel}
                ortText={ortText}
                onGriff={griff}
                onTaste={taste}
                onVerlassen={() => setBewegt(null)}
                onUeber={setUeber}
                onDrop={(event, zelle) => {
                  setUeber(null);
                  const was = abgelegt(event, props.woche.schichten, props.vorlagen);
                  if (was) props.onAblegen(was, zielAus(zelle));
                }}
              />
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};

/** A row of the grid: the person, then a cell per day that takes a dropped shift or template */
const Zeile = (props: {
  zeile: Planzeile;
  index: number;
  tage: readonly Tag[];
  raster: RasterProps;
  bewegt: string | null;
  istZiel: (zelle: Zelle) => boolean;
  ortText: (zelle: Zelle) => string;
  onGriff: (schicht: Schicht, zelle: Zelle) => void;
  onTaste: (event: KeyboardEvent) => void;
  onVerlassen: () => void;
  onUeber: (schluessel: string | null) => void;
  onDrop: (event: DragEvent, zelle: Zelle) => void;
}) => (
  <tr class="border-border border-b last:border-0">
    <th scope="row" class="px-3 py-2.5 text-start align-top font-medium">
      <div class="flex flex-col gap-0.5">
        <span>{props.zeile.name}</span>
        <Show when={props.zeile.unter}>
          <span class="font-normal text-[12px] text-muted-foreground">{props.zeile.unter}</span>
        </Show>
      </div>
    </th>
    <For each={props.zeile.zellen} keyed={false}>
      {(schichten, spalte) => {
        const zelle = () => ({ zeile: props.index, spalte: spalte });
        const ziel = () => ({ nutzerId: props.zeile.nutzerId, tag: props.tage[spalte] ?? "" });
        return (
          <td
            data-zelle={zielSchluessel(ziel())}
            class={cn(
              "group p-1.5 align-top",
              WOCHENENDE.has(spalte) && "bg-muted",
              props.istZiel(zelle()) && "outline-2 outline-foreground -outline-offset-2",
            )}
            onDragOver={(event) => {
              if (!props.raster.planer || !ziehbar(event)) return;
              event.preventDefault();
              props.onUeber(zielSchluessel(ziel()));
            }}
            onDragLeave={() => props.onUeber(null)}
            onDrop={(event) => {
              if (!props.raster.planer) return;
              event.preventDefault();
              props.onDrop(event, zelle());
            }}
          >
            <div class="flex flex-col gap-1">
              {/* keyed by id: a reload keeps the handle a shift was picked up with */}
              <For each={schichten()} keyed={(schicht) => schicht.schichtId}>
                {(schicht) => (
                  <Block
                    schicht={schicht()}
                    vorlagen={props.raster.vorlagen}
                    befunde={befundeDer(props.raster.woche.befunde, schicht().schichtId)}
                    planer={props.raster.planer}
                    griffName={m.plan_verschieben({
                      zeit: spanneText(schicht()),
                      ort: props.ortText(zelle()),
                    })}
                    aufgenommen={props.bewegt === schicht().schichtId}
                    onOeffnen={() => props.raster.onOeffnen(schicht())}
                    onGriff={() => props.onGriff(schicht(), zelle())}
                    onGriffTaste={props.onTaste}
                    onGriffVerlassen={props.onVerlassen}
                  />
                )}
              </For>
              <Show when={props.raster.planer}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={m.plan_hinzufuegen_fuer({ ort: props.ortText(zelle()) })}
                  class="w-full opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => props.raster.onNeu(ziel())}
                >
                  <Icon icon={Plus} />
                </Button>
              </Show>
            </div>
          </td>
        );
      }}
    </For>
  </tr>
);
