import { Show } from "solid-js";
import type uPlot from "uplot";
import { type ChartFarben, UPlotChart } from "../charts/uplotChart.tsx";
import { monatText } from "../monat/text.ts";
import { saldoText } from "../monat/zeilen.ts";
import { m } from "../paraglide/messages.js";
import { type UeberstundenVerlaufPunkt, ueberstundenChartDaten } from "./ueberstundenChartDaten.ts";

const MONO_FONT = "11px Geist Mono Variable, ui-monospace, monospace";
const SANS_FONT = "11px Geist Variable, ui-sans-serif, sans-serif";

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

const kurzMonat = (monat: string): string => {
  const voll = monatText(monat);
  return voll.split(" ")[0]?.slice(0, 3) ?? monat;
};

/**
 * Compact uPlot trend card for the monthly overtime balance on /abwesenheiten.
 */
export const UeberstundenChart = (props: { verlauf: UeberstundenVerlaufPunkt[] | undefined }) => {
  const daten = () => ueberstundenChartDaten(props.verlauf);

  const aligned = (): uPlot.AlignedData => {
    const d = daten();
    return [d.indizes, d.stunden];
  };

  const optionen = (farben: ChartFarben): Omit<uPlot.Options, "width" | "height"> => {
    const d = daten();
    const farbe = d.letzterSaldoMinuten >= 0 ? farben.success : farben.danger;
    return {
      scales: {
        x: { time: false },
        y: {
          auto: true,
          range: (_u, min, max) => {
            const oben = Math.max(2, Math.ceil(Math.max(0, max) + 0.5));
            const unten = min < 0 ? -Math.max(2, Math.ceil(Math.abs(min) + 0.5)) : 0;
            return [unten, oben];
          },
        },
      },
      axes: [
        {
          stroke: farben.mutedForeground,
          font: SANS_FONT,
          grid: { show: false },
          ticks: { stroke: farben.border, width: 1 },
          splits: () => d.indizes,
          values: (_u, vals) => vals.map((i) => kurzMonat(d.monate[i] ?? "")),
        },
        {
          stroke: farben.mutedForeground,
          font: MONO_FONT,
          grid: { stroke: farben.border, width: 1 },
          ticks: { show: false },
          size: 48,
          values: (_u, vals) => vals.map((v) => `${v > 0 ? "+" : ""}${v} h`),
        },
      ],
      series: [
        {
          label: m.monat_monat(),
          value: (_u, v) => (v == null ? "–" : monatText(d.monate[v] ?? "")),
        },
        {
          label: m.konten_ueberstunden(),
          stroke: farbe,
          fill: hexZuRgba(farbe, 0.14),
          width: 2,
          points: { show: true, size: 6, fill: farbe },
          value: (_u, v) => (v == null ? "–" : saldoText(Math.round(v * 60))),
        },
      ],
      cursor: { drag: { x: false, y: false } },
    };
  };

  return (
    <Show when={daten().hatDaten}>
      <div class="flex flex-col gap-2 rounded-xl border border-border bg-background p-4">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-semibold text-[13px] text-foreground">{m.konten_verlauf_titel()}</h3>
          <span
            class={`font-mono font-semibold text-[12px] tabular-nums ${
              daten().letzterSaldoMinuten >= 0 ? "text-success" : "text-danger"
            }`}
            dir="ltr"
          >
            {saldoText(daten().letzterSaldoMinuten)}
          </span>
        </div>
        <UPlotChart
          label={m.konten_verlauf_label()}
          hoehe={155}
          daten={aligned()}
          optionen={optionen}
        />
      </div>
    </Show>
  );
};
