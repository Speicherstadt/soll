import type { JSX } from "@solidjs/web";
import { plusTage, tagInBerlin } from "@soll/arbeitszeit";
import { cn } from "@soll/ui";
import { createEffect, createMemo, createSignal, Show, untrack } from "solid-js";
import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { istInhaber } from "../sitzung/ziel.ts";
import { type OffenerDialog, PlanDialoge } from "./dialoge.tsx";
import { type PlanAnsicht, plusMonatTag } from "./farben.ts";
import { PlanInhalt } from "./inhalt.tsx";
import { PlanKopf } from "./kopf.tsx";
import { ausVorlage, bleibt, PLAN_AENDERT, verschieben } from "./quelle.ts";
import { TauschBereich } from "./tauschBereich.tsx";
import type { Standort, Vorlage, Woche, Ziel } from "./typen.ts";
import { veroeffentlichung } from "./veroeffentlichung.ts";
import type { Abgelegt } from "./ziehen.ts";

/** Owner and planner plan; the server checks it again on every call (rollen.ts) */
const istPlaner = () =>
  (aktuellerBetrieb()?.rolle ?? "")
    .split(",")
    .some((rolle) => ["inhaber", "planer"].includes(rolle.trim()));

/** The owner keeps the data of a person the rules need (S-502) */
const istInhaberHier = () => {
  const betrieb = aktuellerBetrieb();
  return betrieb !== null && istInhaber(betrieb);
};

type Ablage = { was: Abgelegt; ziel: Ziel; standortId: string };

/** Wraps the plan and locks surrounding app navigation inert while TV Fullscreen overlays the viewport */
const VollbildRahmen = (props: {
  aktiv: boolean;
  onBeenden: () => void;
  children: JSX.Element;
}) => {
  let huelleRef: HTMLDivElement | undefined;
  createEffect(
    () => props.aktiv,
    (an) => {
      if (!an || typeof document === "undefined") return;
      const vorher = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const navs = [...document.querySelectorAll<HTMLElement>("nav")].filter(
        (el) => !huelleRef?.contains(el),
      );
      for (const el of navs) el.inert = true;
      huelleRef?.focus();
      const esc = (e: KeyboardEvent) => {
        if (e.key === "Escape") props.onBeenden();
      };
      window.addEventListener("keydown", esc);
      return () => {
        window.removeEventListener("keydown", esc);
        for (const el of navs) el.inert = false;
        vorher?.focus();
      };
    },
  );
  return (
    <div
      ref={huelleRef}
      tabindex={props.aktiv ? -1 : undefined}
      class={cn(
        "flex flex-col gap-5 outline-hidden",
        props.aktiv && "fixed inset-0 z-50 overflow-auto overscroll-contain bg-background p-6",
      )}
    >
      <Show when={props.aktiv}>
        <h2 class="font-semibold text-[22px] tracking-tight">{m.nav_dienstplan()}</h2>
      </Show>
      {props.children}
    </div>
  );
};

/**
 * The plan of the sites of a business: Day/Week/Month views, color-coded shifts, Print & TV
 * Fullscreen mode, templates for planners, dialogs, and shift swap (S-504).
 */
export const Plan = (props: { standorte: Standort[]; tag?: string | undefined }) => {
  const [standortId, setStandortId] = createSignal(() => props.standorte[0]?.standortId ?? "");
  const [tag, setTag] = createSignal(untrack(() => props.tag) ?? tagInBerlin(Date.now()));
  const [ansicht, setAnsicht] = createSignal<PlanAnsicht>("woche");
  const [vollbild, setVollbild] = createSignal(false);
  const [offen, setOffen] = createSignal<OffenerDialog>(null);
  const [ansage, setAnsage] = createSignal("");
  const [fehler, setFehler] = createSignal("");

  const woche = abfrage<Woche>(() => ressourcen.woche({ standortId: standortId(), tag: tag() }));
  const geladen = () => daten(woche.data);
  const vorlagenAbfrage = abfrage<{ vorlagen: Vorlage[] }>(() =>
    istPlaner() ? ressourcen.vorlagen() : null,
  );
  const vorlagen = () => (istPlaner() ? (daten(vorlagenAbfrage.data)?.vorlagen ?? []) : []);
  const rollen = createMemo(() => [
    ...new Set(
      vorlagen()
        .map((v) => v.rolle)
        .filter(Boolean),
    ),
  ]);
  const ablage = aenderung(
    ({ was, ziel, standortId: ort }: Ablage) =>
      "schicht" in was ? verschieben(was.schicht, ziel) : ausVorlage(was.vorlage, ort, ziel),
    () => PLAN_AENDERT,
    { immer: true },
  );
  const veroeffentlichen = veroeffentlichung(setFehler);
  const dieseWoche = () => ({ ort: standortId(), am: tag() });
  const ablegen = async (was: Abgelegt, ziel: Ziel) => {
    if ("schicht" in was && bleibt(was.schicht, ziel)) return;
    const ergebnis = await ablage.mutate({ was, ziel, standortId: standortId() });
    setFehler(
      ergebnis.ok
        ? ""
        : ergebnis.fehler === "zeit_gibt_es_nicht"
          ? m.plan_fehler_zeit()
          : m.fehler_speichern(),
    );
  };
  const schritt = (delta: -1 | 1) => {
    if (ansicht() === "tag") setTag((alt) => plusTage(alt, delta));
    else if (ansicht() === "monat") setTag((alt) => plusMonatTag(alt, delta));
    else setTag((alt) => plusTage(alt, 7 * delta));
  };
  return (
    <VollbildRahmen aktiv={vollbild()} onBeenden={() => setVollbild(false)}>
      <PlanKopf
        woche={geladen() ?? null}
        tag={tag()}
        ansicht={ansicht()}
        vollbild={vollbild()}
        standorte={props.standorte}
        standortId={standortId()}
        planer={istPlaner()}
        inhaber={istInhaberHier()}
        onAnsicht={setAnsicht}
        onSchritt={schritt}
        onStandort={setStandortId}
        onDrucken={() => window.print()}
        onVollbild={() => setVollbild((v) => !v)}
        onVorlagen={() => setOffen({ art: "vorlagen" })}
        onBedarf={() => setOffen({ art: "bedarf" })}
        onAngaben={() => setOffen({ art: "angaben" })}
        onKalender={() => setOffen({ art: "kalender" })}
        onVeroeffentlichen={() => void veroeffentlichen.veroeffentlichen(dieseWoche())}
        veroeffentlicht={veroeffentlichen.laeuft()}
      />
      <Fehler text={fehler() || (woche.data.ok ? "" : m.laden_fehler())} />
      <p role="status" class="text-success empty:hidden">
        {veroeffentlichen.gemeldet(dieseWoche())}
      </p>
      <Show when={geladen()}>
        {(aktuell) => (
          <PlanInhalt
            woche={aktuell()}
            vorlagen={vorlagen()}
            planer={istPlaner()}
            tag={tag()}
            ansicht={ansicht()}
            standortId={standortId()}
            vollbild={vollbild()}
            onTag={setTag}
            onTagAnsicht={(zielTag) => {
              setTag(zielTag);
              setAnsicht("tag");
            }}
            onOeffnen={(schicht) =>
              setOffen({ art: "schicht", modus: { art: "bearbeiten", schicht } })
            }
            onNeu={(ziel) => setOffen({ art: "schicht", modus: { art: "neu", ziel } })}
            onAblegen={(was, ziel) => void ablegen(was, ziel)}
            ansagen={setAnsage}
          />
        )}
      </Show>
      <Show when={!vollbild()}>
        <div data-print-hidden="">
          <TauschBereich
            ich={{ nutzerId: aktuellerBetrieb()?.nutzerId ?? "", planer: istPlaner() }}
            inhaber={istInhaberHier()}
          />
        </div>
      </Show>
      <p class="sr-only" aria-live="polite">
        {ansage()}
      </p>
      <PlanDialoge
        offen={offen()}
        standortId={standortId()}
        personen={geladen()?.personen ?? []}
        vorlagen={vorlagen()}
        rollen={rollen()}
        onSchliessen={() => setOffen(null)}
      />
    </VollbildRahmen>
  );
};
