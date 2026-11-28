import path from "node:path";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import solid from "@solidjs/vite-plugin";
import { compile } from "tailwindcss";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PlanBefund, Schicht, Vorlage, Woche } from "./typen.ts";

const WEB_ROOT = path.resolve(import.meta.dirname, "../..");

type RenderFn = (fn: () => unknown) => Promise<string>;
type CreateCompFn = (comp: unknown, props: Record<string, unknown>) => unknown;
type QueryMod = {
  QueryClient: new (
    opts: Record<string, unknown>,
  ) => {
    setQueryData: (key: readonly unknown[], data: unknown) => void;
  };
  QueryClientProvider: unknown;
};

const schicht = (
  id: string,
  tag: string,
  beginnIso: string,
  endeIso: string,
  nutzerId: string | null = "tom",
): Schicht => ({
  schichtId: id,
  standortId: "st1",
  tag,
  beginn: Date.parse(beginnIso),
  ende: Date.parse(endeIso),
  pauseMinuten: 30,
  rolle: "Service",
  nutzerId,
  vorlageId: null,
  veroeffentlichtAm: 1,
});

describe("dienstplan (tdd-review #124)", () => {
  let vite: ViteDevServer;
  let renderToString: RenderFn;
  let createComponent: CreateCompFn;
  let queryMod: QueryMod;

  beforeAll(async () => {
    vite = await createServer({
      root: WEB_ROOT,
      configFile: false,
      logLevel: "silent",
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: "custom",
      plugins: [
        paraglideVitePlugin({
          project: path.resolve(WEB_ROOT, "../../project.inlang"),
          outdir: path.resolve(WEB_ROOT, "src/paraglide"),
          strategy: ["localStorage", "cookie", "preferredLanguage", "baseLocale"],
        }),
        solid({ ssr: true }),
      ],
    });
    const web = (await vite.ssrLoadModule("@solidjs/web")) as { renderToString: RenderFn };
    const core = (await vite.ssrLoadModule("solid-js")) as { createComponent: CreateCompFn };
    queryMod = (await vite.ssrLoadModule("@tanstack/solid-query")) as QueryMod;
    renderToString = web.renderToString;
    createComponent = core.createComponent;
  }, 30_000);

  afterAll(async () => {
    await vite?.close();
  });

  it("MonatsAnsicht: renders 5-week month (Dec 2026) without suspending forever on unused 6th query slot", async () => {
    const { MonatsAnsicht } = (await vite.ssrLoadModule("/src/dienstplan/monatsAnsicht.tsx")) as {
      MonatsAnsicht: unknown;
    };
    const { ressourcen } = (await vite.ssrLoadModule("/src/abfragen/schluessel.ts")) as {
      ressourcen: { woche: (p: { standortId: string; tag: string }) => { schluessel: unknown[] } };
    };

    const decShift = schicht(
      "s-dec",
      "2026-12-10",
      "2026-12-10T08:00:00+01:00",
      "2026-12-10T16:00:00+01:00",
    );
    const qc = new queryMod.QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    for (const montag of ["2026-11-30", "2026-12-07", "2026-12-14", "2026-12-21", "2026-12-28"]) {
      qc.setQueryData(ressourcen.woche({ standortId: "st1", tag: montag }).schluessel, {
        ok: true,
        status: 200,
        daten: {
          standortId: "st1",
          tage: [montag],
          kw: { jahr: 2026, nummer: 50 },
          personen: [{ nutzerId: "tom", name: "Tom" }],
          schichten: montag === "2026-12-07" ? [decShift] : [],
          deckung: null,
          befunde: null,
        } satisfies Woche,
      });
    }

    const html = await renderToString(() =>
      createComponent(queryMod.QueryClientProvider, {
        client: qc,
        get children() {
          return createComponent(MonatsAnsicht, {
            standortId: "st1",
            tag: "2026-12-01",
            personen: [{ nutzerId: "tom", name: "Tom" }],
            vorlagen: [],
            planer: true,
            onTagOeffnen: () => {},
            onOeffnen: () => {},
          });
        },
      }),
    );

    expect(html).toContain("08:00 Tom");
  });

  it("MonatsAnsicht: resolves colleague names from other weeks of the month (non-planner view)", async () => {
    const { MonatsAnsicht } = (await vite.ssrLoadModule("/src/dienstplan/monatsAnsicht.tsx")) as {
      MonatsAnsicht: unknown;
    };
    const { ressourcen } = (await vite.ssrLoadModule("/src/abfragen/schluessel.ts")) as {
      ressourcen: { woche: (p: { standortId: string; tag: string }) => { schluessel: unknown[] } };
    };

    const leaShift = schicht(
      "s-lea",
      "2026-11-18",
      "2026-11-18T08:00:00+01:00",
      "2026-11-18T16:00:00+01:00",
      "lea",
    );
    const qc = new queryMod.QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    for (const montag of [
      "2026-10-26",
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ]) {
      qc.setQueryData(ressourcen.woche({ standortId: "st1", tag: montag }).schluessel, {
        ok: true,
        status: 200,
        daten: {
          standortId: "st1",
          tage: [montag],
          kw: { jahr: 2026, nummer: 47 },
          personen: montag === "2026-11-16" ? [{ nutzerId: "lea", name: "Lea" }] : [],
          schichten: montag === "2026-11-16" ? [leaShift] : [],
          deckung: null,
          befunde: null,
        } satisfies Woche,
      });
    }

    const html = await renderToString(() =>
      createComponent(queryMod.QueryClientProvider, {
        client: qc,
        get children() {
          return createComponent(MonatsAnsicht, {
            standortId: "st1",
            tag: "2026-11-02",
            personen: [{ nutzerId: "tom", name: "Tom" }],
            vorlagen: [],
            planer: false,
            onTagOeffnen: () => {},
            onOeffnen: () => {},
          });
        },
      }),
    );

    expect(html).toContain("08:00 Lea");
  });

  it("MonatsAnsicht: renders the person filter when a business has 1 person", async () => {
    const { MonatsAnsicht } = (await vite.ssrLoadModule("/src/dienstplan/monatsAnsicht.tsx")) as {
      MonatsAnsicht: unknown;
    };
    const { ressourcen } = (await vite.ssrLoadModule("/src/abfragen/schluessel.ts")) as {
      ressourcen: { woche: (p: { standortId: string; tag: string }) => { schluessel: unknown[] } };
    };

    const qc = new queryMod.QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    for (const montag of [
      "2026-10-26",
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ]) {
      qc.setQueryData(ressourcen.woche({ standortId: "st1", tag: montag }).schluessel, {
        ok: true,
        status: 200,
        daten: {
          standortId: "st1",
          tage: [montag],
          kw: { jahr: 2026, nummer: 47 },
          personen: [{ nutzerId: "jonas", name: "Jonas" }],
          schichten: [],
          deckung: null,
          befunde: null,
        } satisfies Woche,
      });
    }

    const html = await renderToString(() =>
      createComponent(queryMod.QueryClientProvider, {
        client: qc,
        get children() {
          return createComponent(MonatsAnsicht, {
            standortId: "st1",
            tag: "2026-11-23",
            personen: [{ nutzerId: "jonas", name: "Jonas" }],
            vorlagen: [],
            planer: true,
            onTagOeffnen: () => {},
            onOeffnen: () => {},
          });
        },
      }),
    );

    expect(html).toContain("<select");
  });

  it("PlanKopf: secondary desktop buttons resolve to display:none on mobile (< sm) in Tailwind v4 cascade", async () => {
    const { PlanKopf } = (await vite.ssrLoadModule("/src/dienstplan/kopf.tsx")) as {
      PlanKopf: unknown;
    };

    const html = await renderToString(() =>
      createComponent(PlanKopf, {
        woche: null,
        tag: "2026-11-23",
        ansicht: "woche",
        vollbild: false,
        standorte: [{ standortId: "st1", name: "Elbe" }],
        standortId: "st1",
        planer: true,
        inhaber: true,
        onAnsicht: () => {},
        onSchritt: () => {},
        onStandort: () => {},
        onDrucken: () => {},
        onVollbild: () => {},
        onVorlagen: () => {},
        onBedarf: () => {},
        onAngaben: () => {},
        onKalender: () => {},
        onVeroeffentlichen: () => {},
        veroeffentlicht: false,
      }),
    );

    // Extract class attributes of every <button> (and any wrapper around secondary buttons)
    const buttonClasses = [...html.matchAll(/<button[^>]*\bclass="([^"]+)"[^>]*>/g)].map(
      (m) => m[1] ?? "",
    );
    const desktopOnlyButtons = buttonClasses.filter((c) => /\b(hidden|max-sm:hidden)\b/.test(c));
    expect(desktopOnlyButtons.length).toBeGreaterThanOrEqual(5);

    const compiler = await compile("@theme { --breakpoint-sm: 40rem; } @tailwind utilities;");
    for (const cls of desktopOnlyButtons) {
      const tokens = cls.split(/\s+/).filter(Boolean);
      const css = compiler.build(tokens);
      // Remove desktop min-width media blocks so only rules active at < 40rem remain
      const mobileCss = css.replace(/@media\s*\(width\s*>=\s*[^)]+\)\s*\{[\s\S]*?\}\s*\}/g, "");
      const activeDisplays: { rule: string; display: string }[] = [];
      for (const m of mobileCss.matchAll(/([^{}]+)\{[^}]*display:\s*([^;}\s]+)/g)) {
        activeDisplays.push({ rule: (m[1] ?? "").trim(), display: (m[2] ?? "").trim() });
      }
      const winner = activeDisplays.at(-1);
      expect(winner?.display, `class="${cls}" -> ${JSON.stringify(activeDisplays)}`).toBe("none");
    }
  });

  it("TagesAnsicht: shift bar starting at 23:45 stays within 100% timeline width", async () => {
    const { TagesAnsicht } = (await vite.ssrLoadModule("/src/dienstplan/tagesAnsicht.tsx")) as {
      TagesAnsicht: (props: Record<string, unknown>) => unknown;
    };

    const lateShift = schicht(
      "s-late",
      "2026-11-23",
      "2026-11-23T23:45:00+01:00",
      "2026-11-24T06:00:00+01:00",
    );
    const woche: Woche = {
      standortId: "st1",
      tage: [
        "2026-11-23",
        "2026-11-24",
        "2026-11-25",
        "2026-11-26",
        "2026-11-27",
        "2026-11-28",
        "2026-11-29",
      ],
      kw: { jahr: 2026, nummer: 48 },
      personen: [{ nutzerId: "tom", name: "Tom" }],
      schichten: [lateShift],
      deckung: null,
      befunde: null,
    };

    const html = await renderToString(() =>
      createComponent(TagesAnsicht, {
        woche,
        vorlagen: [] satisfies Vorlage[],
        planer: true,
        tag: "2026-11-23",
        onTag: () => {},
        onOeffnen: () => {},
        onNeu: () => {},
      }),
    );

    const match = html.match(/inset-inline-start:([\d.]+)%;width:([\d.]+)%/);
    expect(match).not.toBeNull();
    const startPct = Number.parseFloat(match?.[1] ?? "NaN");
    const widthPct = Number.parseFloat(match?.[2] ?? "NaN");
    expect(startPct + widthPct).toBeLessThanOrEqual(100.001);
  });

  it("rahmenVon: preserves finding border and --accent on assigned shift without role hue", async () => {
    const { rahmenVon } = (await vite.ssrLoadModule("/src/dienstplan/block.tsx")) as {
      rahmenVon: (s: Schicht, v: readonly Vorlage[], b: readonly PlanBefund[]) => string;
    };
    const s = schicht("s1", "2026-11-23", "2026-11-23T08:00:00+01:00", "2026-11-23T19:00:00+01:00");
    const verstoss: PlanBefund = {
      regel: "R-02",
      norm: "§ 3 ArbZG",
      schwere: "verstoss",
      art: "tageszeit",
      tage: ["2026-11-23"],
      nutzerId: "tom",
      schichtIds: ["s1"],
    };
    const cls = rahmenVon(s, [], [verstoss]);
    expect(cls).toBe("border border-danger bg-accent");
  });
});
