import type { Ausblick, TagesBefund } from "@soll/arbeitszeit";
import { Icon } from "@soll/ui";
import { CircleAlert, CircleCheck, Clock, TriangleAlert } from "lucide";
import { For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { ausblickText, befundText } from "./text.ts";

/** The next finding ahead on Heute (design/mockup/Main.dc.html): when, what, and its norm */
export const AusblickKarte = (props: { ausblick: Ausblick }) => {
  const text = () => ausblickText(props.ausblick);
  return (
    <div class="flex items-start gap-2.5 rounded-xl bg-warning-surface px-3.5 py-3 text-foreground">
      <Icon icon={Clock} size={20} class="mt-px shrink-0 text-warning" />
      <div class="flex flex-col gap-0.5">
        <span class="font-semibold text-[15px]">{text().titel}</span>
        {/* muted grey on the warning surface stays below 4.5:1 (axe), so the text keeps its colour */}
        <span class="text-[13px]">{`${text().text} · ${props.ausblick.norm}`}</span>
      </div>
    </div>
  );
};

/**
 * The findings of a day with their severity in words and their norm; green means checked and in
 * order, nothing else (DESIGN.md, "Befund mit Norm")
 */
export const BefundListe = (props: {
  befunde: TagesBefund[];
  nichtHinterlegt: boolean;
  /** While the shift is still running on Heute, frame findings as a prompt to check rather than a red breach */
  laufend?: boolean;
}) => (
  <section aria-labelledby="befunde-titel" class="flex flex-col gap-2">
    <h2 id="befunde-titel" class="font-semibold text-[13px] text-muted-foreground">
      {m.befunde_titel()}
    </h2>
    <Show when={props.nichtHinterlegt}>
      <p class="text-muted-foreground">{m.tag_nicht_hinterlegt()}</p>
    </Show>
    <Show when={props.befunde.length === 0 && !props.nichtHinterlegt}>
      <p class="flex items-center gap-2 text-success">
        <Icon icon={CircleCheck} />
        {m.befunde_keine()}
      </p>
    </Show>
    <Show when={props.befunde.length > 0}>
      <ul class="flex flex-col gap-2">
        <For each={props.befunde}>
          {(befund) => {
            const text = () => befundText(befund);
            const verstoss = () => text().schwere === "verstoss";
            const dringend = () => verstoss() && !props.laufend;
            const stufe = () =>
              !verstoss()
                ? m.befund_hinweis()
                : props.laufend
                  ? m.befund_pruefen()
                  : m.befund_verstoss();
            return (
              <li class="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2">
                <Icon
                  icon={dringend() ? TriangleAlert : CircleAlert}
                  class={
                    dringend() ? "mt-0.5 shrink-0 text-danger" : "mt-0.5 shrink-0 text-warning"
                  }
                />
                <span class="flex flex-col">
                  <span class="font-medium">{text().titel}</span>
                  <span class="text-[12px] text-muted-foreground">
                    {`${stufe()} · ${text().norm}`}
                  </span>
                </span>
              </li>
            );
          }}
        </For>
      </ul>
    </Show>
  </section>
);
