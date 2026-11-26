import type { KinderkrankErgebnis } from "@soll/arbeitszeit";
import { Show } from "solid-js";
import { Wert } from "../konten/konten.tsx";
import { m } from "../paraglide/messages.js";

/** The days of Kind krank of the year per child, against the yearly value (R-28) */
const zaehler = (k: KinderkrankErgebnis): string => {
  if (!k.ok) return m.abw_nicht_hinterlegt();
  const kinder = Object.entries(k.wert.jeKind);
  if (kinder.length === 0)
    return m.abw_kinderkrank_keine({ anspruch: String(k.wert.anspruchJeKind) });
  const tage = kinder.map(([kind, anzahl]) =>
    m.abw_kinderkrank_kind({ kind, tage: String(anzahl), anspruch: String(k.wert.anspruchJeKind) }),
  );
  // the days with sickness benefit are used up: the business need not refuse (R-28)
  const hinweise = k.wert.befunde.map((b) =>
    m.abw_kinderkrank_hinweis({ kind: b.kind, norm: b.norm }),
  );
  return [...tage, ...hinweise].join(" · ");
};

export const Kinderkrank = (props: { jahr: number; stand: KinderkrankErgebnis | null }) => (
  <Show when={props.stand}>
    {(stand) => (
      <Wert name={m.abw_kinderkrank({ jahr: String(props.jahr) })}>{zaehler(stand())}</Wert>
    )}
  </Show>
);
