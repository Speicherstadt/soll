import type { JSX } from "@solidjs/web";
import { Badge } from "@soll/ui";
import { createUniqueId } from "solid-js";
import { STATUS } from "./text.ts";
import type { Abwesenheit } from "./typen.ts";

/** A card of the page with its heading (design/mockup/Abwesenheit.dc.html) */
export const Karte = (props: { titel: string; children: JSX.Element }) => {
  const id = createUniqueId();
  return (
    <section
      aria-labelledby={id}
      class="flex h-full flex-col gap-3 rounded-xl border border-border bg-background p-4"
    >
      <h2 id={id} class="font-semibold">
        {props.titel}
      </h2>
      {props.children}
    </section>
  );
};

const TON: Record<Abwesenheit["status"], "neutral" | "success" | "warning" | "danger"> = {
  beantragt: "warning",
  genehmigt: "success",
  abgelehnt: "danger",
  zurueckgezogen: "neutral",
  storniert: "neutral",
};

/** The state of an absence, as word and color (DESIGN.md: never color alone) */
export const StatusMarke = (props: { status: Abwesenheit["status"] }) => (
  <Badge ton={TON[props.status]}>{STATUS[props.status]()}</Badge>
);
