import { createSignal, createUniqueId, Show } from "solid-js";
import uPlot from "uplot";
import { saldoAchseText, stundenAchseText } from "../charts/achsen.ts";
import { type ChartFarben, UPlotChart } from "../charts/uplotChart.tsx";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { type MonatChartDaten, monatChartDaten } from "./monatChartDaten.ts";
import { saldoText, type Zeile } from "./zeilen.ts";

type Ansicht = "tage" | "saldo";

const ACHSEN_FONT = "11px Geist Mono Variable, ui-monospace, monospace";

const hexZuRgba = (farbe: string, alpha: number): string => {
  const clean = farbe.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
    const r = Number.parseInt(clean.slice(1, 3), 16);
    const g = Number.parseInt(clean.slice(3, 5), 16);
    const b = Number.parseInt(clean.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return clean;
};

const saldoOptionen = (
  d: MonatChartDaten,
  farben: ChartFarben,
): Omit<uPlot.Options, "width" | "height"> => {
  const letzter = d.kumSaldoStunden[d.kumSaldoStunden.length - 1] ?? 0;
  const linienFarbe = letzter >= 0 ? farben.success : farben.danger;
  return {
    scales: {
      x: { time: false },
      y: {
        auto: true,
        range: (_u, min, max) => {
          const span = Math.max(2, Math.ceil(Math.max(Math.abs(min), Math.abs(max))));
          return [-span, span];
        },
      },
    },
    axes: [
      {
        stroke: farben.mutedForeground,
        font: ACHSEN_FONT,
        grid: { show: false },
        ticks: { stroke: farben.border, width: 1 },
        incrs: [1, 2, 5],
        values: (_u, vals) => vals.map((v) => `${v}.`),
      },
      {
        stroke: farben.mutedForeground,
        font: ACHSEN_FONT,
        grid: { stroke: farben.border, width: 1 },
        ticks: { show: false },
        size: 52,
        values: (_u, vals) => vals.map(saldoAchseText),
      },
    ],
    series: [
      { label: m.monat_spalte_tag(), value: (_u, v) => (v == null ? "–" : `${v}.`) },
      {
        label: m.monat_saldo(),
        stroke: linienFarbe,
        fill: hexZuRgba(linienFarbe, 0.14),
        width: 2,
        points: { show: true, size: 5, fill: linienFarbe },
        value: (_u, v) => (v == null ? "–" : saldoText(Math.round(v * 60))),
      },
    ],
    cursor: { drag: { x: false, y: false } },
  };
};

const tageOptionen = (
  d: MonatChartDaten,
  farben: ChartFarben,
): Omit<uPlot.Options, "width" | "height"> => {
  const balken = uPlot.paths.bars?.({ size: [0.62, 24], radius: 0.15 });
  const stufe = uPlot.paths.stepped?.({ align: 1 });
  return {
    scales: {
      x: { time: false, range: (_u, min, max) => [min - 0.5, max + 0.5] },
      y: { auto: false, range: [0, d.maxStunden] },
    },
    axes: [
      {
        stroke: farben.mutedForeground,
        font: ACHSEN_FONT,
        grid: { show: false },
        ticks: { stroke: farben.border, width: 1 },
        incrs: [1, 2, 5],
        values: (_u, vals) => vals.map((v) => (Number.isInteger(v) ? `${v}.` : "")),
      },
      {
        stroke: farben.mutedForeground,
        font: ACHSEN_FONT,
        grid: { stroke: farben.border, width: 1 },
        ticks: { show: false },
        size: 48,
        values: (_u, vals) => vals.map(stundenAchseText),
      },
    ],
    series: [
      { label: m.monat_spalte_tag(), value: (_u, v) => (v == null ? "–" : `${v}.`) },
      {
        label: m.monat_ist(),
        stroke: farben.primary,
        fill: hexZuRgba(farben.primary, 0.85),
        width: 1,
        ...(balken ? { paths: balken } : {}),
        points: { show: false },
        value: (_u, v) => (v == null ? "–" : dauerText(Math.round(v * 60))),
      },
      {
        label: m.monat_soll(),
        stroke: farben.mutedForeground,
        width: 1.5,
        dash: [4, 4],
        ...(stufe ? { paths: stufe } : {}),
        points: { show: false },
        value: (_u, v) => (v == null ? "–" : dauerText(Math.round(v * 60))),
      },
    ],
    cursor: { drag: { x: false, y: false } },
  };
};

/**
 * Interactive monthly chart card (uPlot): switches between daily Ist vs. Soll hours (bars + dashed
 * target step line) and the cumulative monthly overtime balance trend.
 */
export const MonatChart = (props: { zeilen: Zeile[] }) => {
  const id = createUniqueId();
  const [ansicht, setAnsicht] = createSignal<Ansicht>("tage");
  const daten = () => monatChartDaten(props.zeilen);

  const aligned = (): uPlot.AlignedData => {
    const d = daten();
    return ansicht() === "saldo"
      ? [d.tage, d.kumSaldoStunden]
      : [d.tage, d.istStunden, d.sollStunden];
  };

  const optionen = (farben: ChartFarben) =>
    ansicht() === "saldo" ? saldoOptionen(daten(), farben) : tageOptionen(daten(), farben);

  return (
    <Show when={daten().hatDaten}>
      <section
        aria-labelledby={id}
        class="flex flex-col gap-3 rounded-xl border border-border bg-background p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 id={id} class="font-semibold text-[13px] text-foreground">
            {m.monat_chart_titel()}
          </h2>
          <fieldset class="inline-flex rounded-lg border border-border bg-muted p-0.5">
            <legend class="sr-only">{m.monat_chart_titel()}</legend>
            <button
              type="button"
              aria-pressed={ansicht() === "tage" ? "true" : "false"}
              onClick={() => setAnsicht("tage")}
              class={`min-h-11 rounded-md px-3 font-medium text-[12px] transition-colors md:min-h-7 ${
                ansicht() === "tage"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.monat_chart_tagesstunden()}
            </button>
            <button
              type="button"
              aria-pressed={ansicht() === "saldo" ? "true" : "false"}
              onClick={() => setAnsicht("saldo")}
              class={`min-h-11 rounded-md px-3 font-medium text-[12px] transition-colors md:min-h-7 ${
                ansicht() === "saldo"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.monat_chart_saldoverlauf()}
            </button>
          </fieldset>
        </div>
        <UPlotChart
          label={m.monat_chart_label()}
          hoehe={210}
          daten={aligned()}
          optionen={optionen}
        />
      </section>
    </Show>
  );
};
