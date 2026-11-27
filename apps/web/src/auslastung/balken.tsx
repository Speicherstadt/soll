import { For } from "solid-js";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import type { Auslastung } from "./typen.ts";

type Teil = { name: () => string; minuten: (a: Auslastung) => number; farbe: string };

/**
 * The parts of the stamped time, in a fixed order and color: billable darkest, internal, then not
 * booked as the quietest; the legend names each with its time, so no part is told by color alone
 */
const TEILE: readonly Teil[] = [
  { name: m.auslastung_abrechenbar, minuten: (a) => a.abrechenbarMinuten, farbe: "bg-primary" },
  { name: m.auslastung_intern, minuten: (a) => a.internMinuten, farbe: "bg-muted-foreground" },
  { name: m.auslastung_ohne_buchung, minuten: (a) => a.ohneBuchungMinuten, farbe: "bg-border" },
];

export const prozentText = (prozent: number | null): string =>
  prozent === null ? "–" : m.auslastung_prozent({ prozent: String(prozent) });

/**
 * A month's utilisation (S-604): stamped time with its share billable as the headline, one bar of
 * its parts (widths as whole minutes through flex-grow, no fractions) and the legend with times
 */
export const AuslastungWerte = (props: { werte: Auslastung }) => {
  return (
    <div class="flex flex-col gap-3">
      <dl class="flex flex-wrap gap-x-8 gap-y-2">
        <div class="flex flex-col">
          <dt class="text-[12px] text-muted-foreground">{m.auslastung_anwesend()}</dt>
          <dd class="font-mono font-semibold text-[22px] tabular-nums">
            {dauerText(props.werte.anwesendMinuten)}
          </dd>
        </div>
        <div class="flex flex-col">
          <dt class="text-[12px] text-muted-foreground">{m.auslastung_anteil()}</dt>
          <dd class="font-semibold text-[22px] tabular-nums">
            {prozentText(props.werte.abrechenbarProzent)}
          </dd>
        </div>
      </dl>
      <div aria-hidden="true" class="flex h-3 w-full gap-0.5 overflow-hidden rounded-sm">
        <For each={TEILE}>
          {(teil) => (
            <span
              class={`${teil.farbe} h-full first:rounded-s-sm last:rounded-e-sm`}
              style={{ "flex-grow": teil.minuten(props.werte), "flex-basis": "0" }}
            />
          )}
        </For>
      </div>
      <dl class="flex flex-wrap gap-x-6 gap-y-1.5">
        <For each={TEILE}>
          {(teil) => (
            <div class="flex items-center gap-2">
              <span aria-hidden="true" class={`${teil.farbe} size-2.5 rounded-sm`} />
              <dt class="text-muted-foreground">{teil.name()}</dt>
              <dd class="font-mono tabular-nums">{dauerText(teil.minuten(props.werte))}</dd>
            </div>
          )}
        </For>
      </dl>
      <p class="text-[12px] text-muted-foreground">{m.auslastung_erklaerung()}</p>
    </div>
  );
};
