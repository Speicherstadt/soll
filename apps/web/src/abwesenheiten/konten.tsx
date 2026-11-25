import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { tageText } from "./text.ts";
import type { Liste } from "./typen.ts";

const Wert = (props: { name: string; children: string }) => (
  <div class="flex flex-col gap-0.5 rounded-xl border border-border p-3">
    <dt class="text-[12px] text-muted-foreground">{props.name}</dt>
    <dd class="font-semibold text-[17px] tabular-nums">{props.children}</dd>
  </div>
);

/** Leave left in the year and the days of Kind krank per child (R-23, R-28) */
export const Konten = (props: { liste: Liste }) => (
  <dl class="grid grid-cols-2 gap-3 md:max-w-lg">
    <Wert name={m.abw_resturlaub({ jahr: String(props.liste.jahr) })}>
      {props.liste.urlaub
        ? m.abw_resturlaub_wert({
            rest: tageText(props.liste.urlaub.restHalbtage),
            anspruch: tageText(props.liste.urlaub.anspruchHalbtage),
          })
        : m.abw_nicht_hinterlegt()}
    </Wert>
    <Show when={props.liste.kinderkrank}>
      {(stand) => (
        <Wert name={m.abw_kinderkrank({ jahr: String(props.liste.jahr) })}>
          {(() => {
            const k = stand();
            if (!k.ok) return m.abw_nicht_hinterlegt();
            const kinder = Object.entries(k.wert.jeKind);
            if (kinder.length === 0)
              return m.abw_kinderkrank_keine({ anspruch: String(k.wert.anspruchJeKind) });
            const zaehler = kinder.map(([kind, tage]) =>
              m.abw_kinderkrank_kind({
                kind,
                tage: String(tage),
                anspruch: String(k.wert.anspruchJeKind),
              }),
            );
            // the days with sickness benefit are used up: the business need not refuse (R-28)
            const hinweise = k.wert.befunde.map((b) =>
              m.abw_kinderkrank_hinweis({ kind: b.kind, norm: b.norm }),
            );
            return [...zaehler, ...hinweise].join(" · ");
          })()}
        </Wert>
      )}
    </Show>
  </dl>
);
