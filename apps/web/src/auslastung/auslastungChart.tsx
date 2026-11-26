import { Show } from "solid-js";
import uPlot from "uplot";
import { type ChartFarben, UPlotChart } from "../charts/uplotChart.tsx";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { auslastungPersonenChartDaten } from "./auslastungChartDaten.ts";
import type { PersonenAntwort } from "./typen.ts";

const kurzName = (name: string): string => {
  const teile = name.trim().split(/\s+/);
  if (teile.length <= 1) return name.slice(0, 12);
  const vor = teile[0] ?? "";
  const nach = teile[teile.length - 1] ?? "";
  return `${vor} ${nach.slice(0, 1)}.`;
};

/**
 * Per-person utilization bar chart (uPlot) comparing billable, internal, and unbooked hours.
 */
export const AuslastungPersonenChart = (props: { personen: PersonenAntwort["personen"] }) => {
  const daten = () => auslastungPersonenChartDaten(props.personen);

  const aligned = (): uPlot.AlignedData => {
    const d = daten();
    return [d.indizes, d.abrechenbarStunden, d.internStunden, d.ohneBuchungStunden];
  };

  const optionen = (farben: ChartFarben): Omit<uPlot.Options, "width" | "height"> => {
    const d = daten();
    const balkenLinks = uPlot.paths.bars?.({ size: [0.24, 22], align: 1, radius: 0.15 });
    const balkenMitte = uPlot.paths.bars?.({ size: [0.24, 22], align: 0, radius: 0.15 });
    const balkenRechts = uPlot.paths.bars?.({ size: [0.24, 22], align: -1, radius: 0.15 });
    const achsenFont = "11px Geist Variable, ui-sans-serif, sans-serif";
    const monoFont = "11px Geist Mono Variable, ui-monospace, monospace";

    return {
      scales: {
        x: {
          time: false,
          range: [-0.5, Math.max(0.5, d.indizes.length - 0.5)],
        },
        y: {
          auto: false,
          range: [0, d.maxStunden],
        },
      },
      axes: [
        {
          stroke: farben.mutedForeground,
          font: achsenFont,
          grid: { show: false },
          ticks: { show: false },
          splits: () => d.indizes,
          values: (_u, vals) => vals.map((i) => kurzName(d.namen[i] ?? "")),
        },
        {
          stroke: farben.mutedForeground,
          font: monoFont,
          grid: { stroke: farben.border, width: 1 },
          ticks: { show: false },
          size: 46,
          values: (_u, vals) => vals.map((v) => `${v} h`),
        },
      ],
      series: [
        {
          label: m.auslastung_person(),
          value: (_u, v) => (v == null ? "–" : (d.namen[v] ?? "–")),
        },
        {
          label: m.auslastung_abrechenbar(),
          stroke: farben.primary,
          fill: farben.primary,
          ...(balkenLinks ? { paths: balkenLinks } : {}),
          points: { show: false },
          value: (_u, v) => (v == null ? "–" : dauerText(Math.round(v * 60))),
        },
        {
          label: m.auslastung_intern(),
          stroke: farben.mutedForeground,
          fill: farben.mutedForeground,
          ...(balkenMitte ? { paths: balkenMitte } : {}),
          points: { show: false },
          value: (_u, v) => (v == null ? "–" : dauerText(Math.round(v * 60))),
        },
        {
          label: m.auslastung_ohne_buchung(),
          stroke: farben.border,
          fill: farben.border,
          ...(balkenRechts ? { paths: balkenRechts } : {}),
          points: { show: false },
          value: (_u, v) => (v == null ? "–" : dauerText(Math.round(v * 60))),
        },
      ],
      cursor: { drag: { x: false, y: false } },
    };
  };

  return (
    <Show when={daten().hatDaten}>
      <div class="rounded-xl border border-border bg-background p-4">
        <UPlotChart
          label={m.auslastung_chart_label()}
          hoehe={200}
          daten={aligned()}
          optionen={optionen}
        />
      </div>
    </Show>
  );
};
