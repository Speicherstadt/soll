import { Badge, Table, Tbody, Td, Th, Thead, Tr } from "@soll/ui";
import { createUniqueId, For, Show } from "solid-js";
import { ART } from "../abwesenheiten/text.ts";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { uhrzeitText } from "../zeiten/text.ts";
import { befundZeile, kurzerTag, tageText } from "./text.ts";
import type { Gegeneintrag, Monatsinhalt } from "./typen.ts";
import { saldoText, type Zeile } from "./zeilen.ts";

const Wert = (props: { name: string; wert: string }) => (
  <div class="flex flex-col gap-0.5 rounded-xl border border-border p-4">
    <dt class="text-[12px] text-muted-foreground">{props.name}</dt>
    <dd class="font-mono font-semibold text-[20px] tabular-nums" dir="ltr">
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
        <p class="rounded-xl border border-border p-4 text-muted-foreground">
          {m.monat_nicht_hinterlegt({ tage: tageText(props.inhalt.nichtHinterlegt) })}
        </p>
      }
    >
      {(summen) => (
        <dl class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Wert name={m.monat_soll()} wert={dauerText(summen().sollMinuten)} />
          <Wert name={m.monat_ist()} wert={dauerText(summen().istMinuten)} />
          <Wert name={m.monat_saldo()} wert={saldoText(summen().saldoMinuten)} />
        </dl>
      )}
    </Show>
  </section>
);

const zeit = (ms: number | null) => (ms === null ? "" : uhrzeitText(ms));

/**
 * The days of the month with begin, end, break, duration and findings; changes by hand are marked
 * (DESIGN.md, "Monatsabschluss"). Days without work, absence and finding are left out, so a phone
 * shows what counts.
 */
export const TageTabelle = (props: { zeilen: Zeile[] }) => {
  const gezeigt = () =>
    props.zeilen.filter(
      (zeile) =>
        zeile.beginn !== null ||
        zeile.befunde.length > 0 ||
        zeile.geaendert ||
        zeile.abwesenheiten.length > 0,
    );
  return (
    <Show
      when={gezeigt().length > 0}
      fallback={<p class="text-muted-foreground">{m.monat_keine_tage()}</p>}
    >
      <Table beschriftung={m.monat_tage()}>
        <Thead>
          <Tr>
            <Th>{m.monat_spalte_tag()}</Th>
            <Th>{m.monat_spalte_beginn()}</Th>
            <Th>{m.monat_spalte_ende()}</Th>
            <Th class="max-md:hidden">{m.monat_spalte_pause()}</Th>
            <Th>{m.monat_spalte_dauer()}</Th>
            <Th>{m.monat_spalte_hinweis()}</Th>
          </Tr>
        </Thead>
        <Tbody>
          <For each={gezeigt()}>
            {(zeile) => (
              <Tr>
                <th scope="row" class="h-9 whitespace-nowrap px-3 text-start font-medium">
                  {kurzerTag(zeile.tag)}
                </th>
                <Td class="font-mono" dir="ltr">
                  {zeit(zeile.beginn)}
                </Td>
                <Td class="font-mono" dir="ltr">
                  {zeit(zeile.ende)}
                </Td>
                <Td class="font-mono max-md:hidden" dir="ltr">
                  {zeile.beginn === null ? "" : dauerText(zeile.pauseMinuten)}
                </Td>
                <Td class="font-mono" dir="ltr">
                  {zeile.beginn === null ? "" : dauerText(zeile.arbeitsMinuten)}
                </Td>
                <Td>
                  <div class="flex flex-col items-start gap-1">
                    <Show when={zeile.geaendert}>
                      <Badge>{m.monat_geaendert()}</Badge>
                    </Show>
                    <For each={zeile.abwesenheiten}>
                      {(a) => (
                        <span>{a.halb ? m.abw_halb({ art: ART[a.art]() }) : ART[a.art]()}</span>
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
            )}
          </For>
        </Tbody>
      </Table>
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
