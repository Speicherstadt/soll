import { Badge, Icon, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { Clock, type IconNode, Scale, Target, TrendingDown, TrendingUp } from "lucide";
import { createUniqueId, For, Show } from "solid-js";
import { ART } from "../abwesenheiten/text.ts";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { uhrzeitText } from "../zeiten/text.ts";
import { befundZeile, kurzerTag, tageText } from "./text.ts";
import type { Gegeneintrag, Monatsinhalt } from "./typen.ts";
import { saldoText, saldoTon, type Zeile } from "./zeilen.ts";

const WERT_TON = {
  default: "text-foreground",
  success: "text-success",
} as const;

const Wert = (props: {
  name: string;
  wert: string;
  icon: IconNode;
  ton?: keyof typeof WERT_TON;
}) => (
  <div class="flex h-full min-w-0 flex-col gap-1 rounded-xl border border-border bg-background p-3 sm:gap-1.5 sm:p-4">
    <dt class="flex min-h-5 items-center gap-1.5 text-[12px] text-muted-foreground sm:min-h-6">
      <Icon icon={props.icon} class="size-3.5 shrink-0 text-muted-foreground" />
      <span class="truncate">{props.name}</span>
    </dt>
    <dd
      class={`font-mono font-semibold text-[16px] tabular-nums leading-tight sm:text-[22px] ${WERT_TON[props.ton ?? "default"]}`}
      dir="ltr"
    >
      {props.wert}
    </dd>
  </div>
);

/** Soll, Ist and balance of the month, or "nicht hinterlegt" with the days that lack a model */
export const Summen = (props: { inhalt: Monatsinhalt }) => (
  <section aria-label={m.monat_summen()}>
    <Show
      when={props.inhalt.summen}
      fallback={
        <p class="rounded-xl border border-border bg-background p-4 text-muted-foreground">
          {m.monat_nicht_hinterlegt({ tage: tageText(props.inhalt.nichtHinterlegt) })}
        </p>
      }
    >
      {(summen) => (
        <div class="flex flex-col gap-2">
          <dl class="grid grid-cols-3 gap-2 sm:gap-3">
            <Wert name={m.monat_soll()} icon={Target} wert={dauerText(summen().sollMinuten)} />
            <Wert name={m.monat_ist()} icon={Clock} wert={dauerText(summen().istMinuten)} />
            <Wert
              name={m.monat_saldo()}
              icon={
                summen().saldoMinuten > 0
                  ? TrendingUp
                  : summen().saldoMinuten < 0
                    ? TrendingDown
                    : Scale
              }
              ton={saldoTon(summen().saldoMinuten)}
              wert={saldoText(summen().saldoMinuten)}
            />
          </dl>
          <Show when={(summen().pausenabzugMinuten ?? 0) > 0}>
            <p class="text-[12px] text-muted-foreground">
              {m.monat_pausenabzug_hinweis({
                dauer: dauerText(summen().pausenabzugMinuten ?? 0),
              })}
            </p>
          </Show>
        </div>
      )}
    </Show>
  </section>
);

const zeit = (ms: number | null) => (ms === null ? "–" : uhrzeitText(ms));

const tagesDiff = (zeile: Zeile): number | null => {
  if (zeile.beginn === null || zeile.sollMinuten === null) return null;
  return zeile.arbeitsMinuten - zeile.sollMinuten;
};

const neueWoche = (vorher: Zeile | undefined, aktuell: Zeile): boolean => {
  if (!vorher) return false;
  const a = Date.parse(`${vorher.tag}T12:00:00Z`);
  const b = Date.parse(`${aktuell.tag}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return (b - a) / 86_400_000 > 1.5;
};

/**
 * The days of the month with begin, end, break, duration, target, daily balance and findings.
 * Grouped visually by week with clean right-aligned monospace numbers for quick scanning.
 */
export const TageTabelle = (props: { zeilen: Zeile[] }) => {
  const gezeigt = () =>
    props.zeilen.filter(
      (zeile) =>
        zeile.beginn !== null ||
        zeile.befunde.length > 0 ||
        zeile.geaendert ||
        zeile.abwesenheiten.length > 0 ||
        (zeile.sollAusPlan && (zeile.sollMinuten ?? 0) > 0),
    );
  return (
    <Show
      when={gezeigt().length > 0}
      fallback={<p class="text-muted-foreground">{m.monat_keine_tage()}</p>}
    >
      <div class="overflow-hidden rounded-xl border border-border bg-background">
        <Table beschriftung={m.monat_tage()}>
          <Thead>
            <Tr>
              <Th>{m.monat_spalte_tag()}</Th>
              <Th class="text-end">{m.monat_spalte_beginn()}</Th>
              <Th class="text-end">{m.monat_spalte_ende()}</Th>
              <Th class="text-end max-md:hidden">{m.monat_spalte_pause()}</Th>
              <Th class="text-end">{m.monat_spalte_dauer()}</Th>
              <Th class="text-end max-lg:hidden">{m.monat_soll()}</Th>
              <Th class="text-end max-md:hidden">{m.monat_saldo()}</Th>
              <Th>{m.monat_spalte_hinweis()}</Th>
            </Tr>
          </Thead>
          <Tbody>
            <For each={gezeigt()}>
              {(zeile, index) => {
                const diff = () => tagesDiff(zeile);
                const wochenStart = () => neueWoche(gezeigt()[index() - 1], zeile);
                return (
                  <Tr class={wochenStart() ? "border-t-2 border-border" : ""}>
                    <th scope="row" class="h-10 whitespace-nowrap px-3 text-start font-medium">
                      {kurzerTag(zeile.tag)}
                    </th>
                    <Td class="text-end font-mono text-muted-foreground tabular-nums">
                      <span dir="ltr">{zeit(zeile.beginn)}</span>
                    </Td>
                    <Td class="text-end font-mono text-muted-foreground tabular-nums">
                      <span dir="ltr">{zeit(zeile.ende)}</span>
                    </Td>
                    <Td class="text-end font-mono text-muted-foreground tabular-nums max-md:hidden">
                      <span dir="ltr">
                        {zeile.beginn === null ? "–" : dauerText(zeile.pauseMinuten)}
                      </span>
                    </Td>
                    <Td class="text-end font-mono font-medium tabular-nums">
                      <span dir="ltr">
                        {zeile.beginn === null ? "–" : dauerText(zeile.arbeitsMinuten)}
                      </span>
                    </Td>
                    <Td class="text-end font-mono text-muted-foreground tabular-nums max-lg:hidden">
                      <span dir="ltr">
                        {zeile.sollMinuten === null ? "–" : dauerText(zeile.sollMinuten)}
                      </span>
                    </Td>
                    <Td
                      class={`text-end font-mono tabular-nums max-md:hidden ${
                        (diff() ?? 0) > 0
                          ? "text-success"
                          : (diff() ?? 0) < 0
                            ? "text-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      <span dir="ltr">{diff() === null ? "–" : saldoText(diff() ?? 0)}</span>
                    </Td>
                    <Td>
                      <div class="flex flex-wrap items-center gap-1">
                        <Show when={zeile.sollAusPlan}>
                          <Badge>{m.target_source_badge()}</Badge>
                        </Show>
                        <Show when={zeile.geaendert}>
                          <Badge>{m.monat_geaendert()}</Badge>
                        </Show>
                        <For each={zeile.abwesenheiten}>
                          {(a) => (
                            <Badge>
                              {a.halb ? m.abw_halb({ art: ART[a.art]() }) : ART[a.art]()}
                            </Badge>
                          )}
                        </For>
                        <For each={zeile.befunde}>
                          {(befund) => (
                            <span class={befund.schwere === "verstoss" ? "text-danger" : ""}>
                              {befundZeile(befund)}
                            </span>
                          )}
                        </For>
                      </div>
                    </Td>
                  </Tr>
                );
              }}
            </For>
          </Tbody>
        </Table>
      </div>
    </Show>
  );
};

/** The counter-entries to closed months entered in this month (S-306) */
export const Gegeneintraege = (props: { eintraege: Gegeneintrag[] }) => {
  const id = createUniqueId();
  return (
    <Show when={props.eintraege.length > 0}>
      <section aria-labelledby={id} class="flex flex-col gap-1.5">
        <h2 id={id} class="font-semibold text-[13px] text-muted-foreground">
          {m.monat_gegeneintraege()}
        </h2>
        <ul class="flex flex-col gap-1">
          <For each={props.eintraege}>
            {(eintrag) => (
              <li>
                {m.monat_gegeneintrag_zeile({
                  tag: kurzerTag(eintrag.tag),
                  minuten: saldoText(eintrag.minuten),
                  grund: eintrag.grund,
                })}
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
};
