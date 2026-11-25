import { cn, Icon } from "@soll/ui";
import { PhoneCall } from "lucide";
import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { BefundIcon, befundeText } from "./block.tsx";
import { spanneText } from "./text.ts";
import type { PlanBefund, Rufdienst } from "./typen.ts";

/*
 * A Rufbereitschaft in the plan (S-505): no working time itself, so it looks unlike a shift, with a
 * phone and a line along its start side instead of a filled block (DESIGN.md, "Dienstplan")
 */

/** The border of a duty: a line along the start side, red or amber with a finding */
const rahmenVon = (befunde: readonly PlanBefund[]) => {
  const schwere = befunde[0]?.schwere;
  if (schwere === "verstoss") return "border border-danger border-s-4";
  if (schwere === "hinweis") return "border border-warning border-s-4";
  return "border border-border border-s-4 border-s-foreground";
};

const Inhalt = (props: { rufdienst: Rufdienst; befunde: readonly PlanBefund[] }) => (
  <>
    <span class="flex items-center justify-between gap-1">
      <span class="flex items-center gap-1">
        <Icon icon={PhoneCall} size={12} />
        <span class="font-mono text-[12px]" dir="ltr">
          {spanneText(props.rufdienst)}
        </span>
      </span>
      <BefundIcon befunde={props.befunde} />
    </span>
    <span class="truncate text-[12px]">{m.oncall_title()}</span>
    <Show when={props.rufdienst.reaktionMinuten !== null}>
      <span class="text-[12px]">
        {m.oncall_response_value({ minuten: String(props.rufdienst.reaktionMinuten) })}
      </span>
    </Show>
    <Show when={props.befunde.length > 0}>
      <span class="text-[12px] md:sr-only">{befundeText(props.befunde)}</span>
    </Show>
  </>
);

/** A duty in a cell of the week or a day's list; for whoever plans a button that opens it */
export const RufBlock = (props: {
  rufdienst: Rufdienst;
  befunde: readonly PlanBefund[];
  planer: boolean;
  onOeffnen: () => void;
}) => {
  const klasse = () =>
    cn(
      "flex w-full min-w-0 flex-col gap-0.5 rounded-sm px-2 py-1.5 text-start",
      rahmenVon(props.befunde),
    );
  return (
    <Show
      when={props.planer}
      fallback={
        <div class={klasse()}>
          <Inhalt rufdienst={props.rufdienst} befunde={props.befunde} />
        </div>
      }
    >
      <button
        type="button"
        class={cn(klasse(), "focus-visible:outline-2 focus-visible:outline-foreground")}
        onClick={() => props.onOeffnen()}
      >
        <Inhalt rufdienst={props.rufdienst} befunde={props.befunde} />
      </button>
    </Show>
  );
};
