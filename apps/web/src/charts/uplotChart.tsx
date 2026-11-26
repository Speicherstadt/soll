import { createEffect, createSignal } from "solid-js";
import uPlot from "uplot";
import "./uplotChart.css";

export type ChartFarben = {
  primary: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  background: string;
  muted: string;
  success: string;
  warning: string;
  danger: string;
};

const cssVar = (stil: CSSStyleDeclaration, name: string, fallback: string): string =>
  stil.getPropertyValue(name).trim() || fallback;

/** Reads the active light/dark theme tokens from :root for uPlot canvas strokes & fills. */
export const chartFarben = (): ChartFarben => {
  if (typeof document === "undefined") {
    return {
      primary: "#18181b",
      foreground: "#09090b",
      mutedForeground: "#71717a",
      border: "#e4e4e7",
      background: "#ffffff",
      muted: "#fafafa",
      success: "#15803d",
      warning: "#b45309",
      danger: "#b91c1c",
    };
  }
  const stil = getComputedStyle(document.documentElement);
  return {
    primary: cssVar(stil, "--primary", "#18181b"),
    foreground: cssVar(stil, "--foreground", "#09090b"),
    mutedForeground: cssVar(stil, "--muted-foreground", "#71717a"),
    border: cssVar(stil, "--border", "#e4e4e7"),
    background: cssVar(stil, "--background", "#ffffff"),
    muted: cssVar(stil, "--muted", "#fafafa"),
    success: cssVar(stil, "--success", "#15803d"),
    warning: cssVar(stil, "--warning", "#b45309"),
    danger: cssVar(stil, "--danger", "#b91c1c"),
  };
};

export type UPlotChartProps = {
  /** Accessible label describing the chart content */
  label: string;
  /** Chart canvas height in px (excluding legend) */
  hoehe?: number;
  /** Aligned uPlot data series */
  daten: uPlot.AlignedData;
  /** Builds uPlot options (without width/height) using the current theme palette */
  optionen: (farben: ChartFarben) => Omit<uPlot.Options, "width" | "height">;
};

/**
 * Responsive, theme-aware Solid 2.0 wrapper around uPlot.
 * Redraws automatically on container resize, data/options change, or light/dark theme switch.
 */
export const UPlotChart = (props: UPlotChartProps) => {
  const [host, setHost] = createSignal<HTMLDivElement | null>(null);
  const [themeTick, setThemeTick] = createSignal(0);

  // Watch light/dark theme changes on <html> and prefers-color-scheme
  createEffect(
    () => host(),
    (el) => {
      if (!el || typeof document === "undefined") return;
      const bump = () => setThemeTick((n) => n + 1);
      const observer = new MutationObserver(bump);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", bump);
      return () => {
        observer.disconnect();
        media.removeEventListener("change", bump);
      };
    },
  );

  // Mount & maintain the uPlot instance + ResizeObserver
  createEffect(
    () => {
      const el = host();
      const daten = props.daten;
      const hoehe = props.hoehe ?? 220;
      const _tick = themeTick();
      void _tick;
      const opts = el ? props.optionen(chartFarben()) : null;
      return { el, daten, hoehe, opts };
    },
    ({ el, daten, hoehe, opts }) => {
      if (!el || !opts) return;
      const breite = Math.max(240, Math.floor(el.clientWidth || 320));
      const vollOpts: uPlot.Options = {
        ...opts,
        width: breite,
        height: hoehe,
      };
      el.replaceChildren();
      const plot = new uPlot(vollOpts, daten, el);

      const resize = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const neueBreite = Math.max(240, Math.floor(entry.contentRect.width));
        if (neueBreite !== plot.width) {
          plot.setSize({ width: neueBreite, height: hoehe });
        }
      });
      resize.observe(el);

      return () => {
        resize.disconnect();
        plot.destroy();
      };
    },
  );

  return (
    <div
      role="img"
      aria-label={props.label}
      dir="ltr"
      class="soll-uplot w-full overflow-hidden"
      ref={(el) => setHost(el)}
    />
  );
};
