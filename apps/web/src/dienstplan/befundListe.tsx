import { Badge, Icon } from "@soll/ui";
import { CircleCheck } from "lucide";
import { createMemo, For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { befundTitel, schwereText } from "./befunde.ts";
import { tagLang } from "./text.ts";
import type { PlanBefund, Planperson } from "./typen.ts";

/** The first day of a finding that has a shift shown, else its first day */
const tagDes = (befund: PlanBefund, tage: readonly string[]): string =>
  befund.tage.find((tag) => tage.includes(tag)) ?? befund.tage[0] ?? "";

/**
 * "Hinweise zum Plan" below the grid (design/mockup/Dienstplan.dc.html): every finding of the week
 * with its severity as a word, the person, the day, what it is and its norm. They warn; nothing is
 * refused (docs/plan.md, "Befunde im Plan").
 */
export const BefundListe = (props: {
  befunde: readonly PlanBefund[];
  personen: readonly Planperson[];
  tage: readonly string[];
}) => {
  const sortiert = createMemo(() =>
    [...props.befunde].sort((a, b) => tagDes(a, props.tage).localeCompare(tagDes(b, props.tage))),
  );
  const name = (nutzerId: string) =>
    props.personen.find((person) => person.nutzerId === nutzerId)?.name ?? "";
  return (
    <section aria-labelledby="plan-befunde-titel" class="flex flex-col gap-2">
      <h2 id="plan-befunde-titel" class="font-semibold text-[15px]">
        {m.plan_befunde_titel({ anzahl: props.befunde.length })}
      </h2>
      <Show
        when={props.befunde.length > 0}
        fallback={
          <p class="flex items-center gap-2 text-success">
            <Icon icon={CircleCheck} />
            {m.plan_befunde_keine()}
          </p>
        }
      >
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          <For each={sortiert()}>
            {(befund) => (
              <li
                data-regel={befund.regel}
                class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-md border border-border px-3 py-2"
              >
                <Badge ton={befund.schwere === "verstoss" ? "danger" : "warning"}>
                  {schwereText(befund)}
                </Badge>
                <span class="flex-[1_1_320px]">
                  {m.plan_befund_ort({
                    name: name(befund.nutzerId),
                    tag: tagLang(tagDes(befund, props.tage)),
                    titel: befundTitel(befund),
                  })}
                </span>
                <span class="text-muted-foreground">{befund.norm}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
};
