import { istTag, plusTage, tagInBerlin } from "@soll/arbeitszeit";
import { createFileRoute } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, Show, untrack } from "solid-js";
import { api } from "../api.ts";
import { type OffenerDialog, PlanDialoge } from "../dienstplan/dialoge.tsx";
import { PlanInhalt } from "../dienstplan/inhalt.tsx";
import { PlanKopf } from "../dienstplan/kopf.tsx";
import { ausVorlage, verschieben, wochenQuelle } from "../dienstplan/quelle.ts";
import type { Standort, Vorlage, Ziel } from "../dienstplan/typen.ts";
import type { Abgelegt } from "../dienstplan/ziehen.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Leer, Seite } from "../rahmen/seite.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { istInhaber } from "../sitzung/ziel.ts";

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

/** The templates of the business, for whoever plans */
const vorlagenQuelle = () => {
  const [vorlagen, setVorlagen] = createSignal<Vorlage[]>([]);
  const laden = async () => {
    const antwort = await api<{ vorlagen: Vorlage[] }>("/api/v1/dienstplan/vorlagen");
    if (antwort.ok) setVorlagen(antwort.daten.vorlagen);
  };
  createEffect(istPlaner, (planer) => {
    if (planer) void laden();
  });
  return { vorlagen, laden };
};

/**
 * Dienstplan (S-501): the week of a site. Owner and planner plan the draft from templates, by drag
 * and drop or the keyboard, and see where the need per role is not covered; everyone else sees what
 * is published (S-503). On a phone one day at a time.
 */
const Dienstplan = () => {
  const [standorte, setStandorte] = createSignal<Standort[] | null>(null);
  const [standortId, setStandortId] = createSignal("");
  const suche = Route.useSearch();
  // a link may name the week to open (?tag=2026-11-23); without one the plan opens this week
  const [tag, setTag] = createSignal(untrack(() => suche().tag) ?? tagInBerlin(Date.now()));
  const [offen, setOffen] = createSignal<OffenerDialog>(null);
  const [ansage, setAnsage] = createSignal("");
  const [fehler, setFehler] = createSignal("");
  const quelle = wochenQuelle();
  const { vorlagen, laden: vorlagenLaden } = vorlagenQuelle();
  api<{ standorte: Standort[] }>("/api/v1/standorte").then((antwort) => {
    const liste = antwort.ok ? antwort.daten.standorte : [];
    setStandorte(liste);
    setStandortId(liste[0]?.standortId ?? "");
  });
  createEffect(
    () => ({ standortId: standortId(), tag: tag() }),
    (anfrage) => {
      if (anfrage.standortId) void quelle.laden(anfrage);
    },
  );
  const rollen = createMemo(() => [
    ...new Set(
      vorlagen()
        .map((v) => v.rolle)
        .filter(Boolean),
    ),
  ]);
  const ablegen = async (was: Abgelegt, ziel: Ziel) => {
    const antwort =
      "schicht" in was
        ? verschieben(was.schicht, ziel)
        : ausVorlage(was.vorlage, standortId(), ziel);
    if (!antwort) return;
    const ergebnis = await antwort;
    const text = ergebnis.ok
      ? ""
      : ergebnis.fehler === "zeit_gibt_es_nicht"
        ? m.plan_fehler_zeit()
        : m.fehler_speichern();
    setFehler(text);
    void quelle.laden();
  };
  return (
    <Seite titel={m.nav_dienstplan()}>
      <Show when={standorte()?.length === 0}>
        <Leer text={m.plan_kein_standort()} />
      </Show>
      <Show when={standortId()}>
        <PlanKopf
          woche={quelle.woche()}
          standorte={standorte() ?? []}
          standortId={standortId()}
          planer={istPlaner()}
          inhaber={istInhaberHier()}
          onWoche={(schritt) => setTag((alt) => plusTage(alt, 7 * schritt))}
          onStandort={setStandortId}
          onVorlagen={() => setOffen({ art: "vorlagen" })}
          onBedarf={() => setOffen({ art: "bedarf" })}
          onAngaben={() => setOffen({ art: "angaben" })}
        />
        <Fehler text={fehler() || (quelle.fehler() ? m.laden_fehler() : "")} />
        <Show when={quelle.woche()}>
          {(woche) => (
            <PlanInhalt
              woche={woche()}
              vorlagen={vorlagen()}
              planer={istPlaner()}
              tag={tag()}
              onTag={setTag}
              onOeffnen={(schicht) =>
                setOffen({ art: "schicht", modus: { art: "bearbeiten", schicht } })
              }
              onNeu={(ziel) => setOffen({ art: "schicht", modus: { art: "neu", ziel } })}
              onAblegen={(was, ziel) => void ablegen(was, ziel)}
              ansagen={setAnsage}
            />
          )}
        </Show>
      </Show>
      <p class="sr-only" aria-live="polite">
        {ansage()}
      </p>
      <PlanDialoge
        offen={offen()}
        standortId={standortId()}
        personen={quelle.woche()?.personen ?? []}
        vorlagen={vorlagen()}
        rollen={rollen()}
        onSchliessen={() => setOffen(null)}
        onPlanGeaendert={() => void quelle.laden()}
        onVorlagenGeaendert={() => void vorlagenLaden()}
      />
    </Seite>
  );
};

export const Route = createFileRoute("/dienstplan")({
  component: Dienstplan,
  validateSearch: (suche: Record<string, unknown>): { tag?: string } =>
    typeof suche.tag === "string" && istTag(suche.tag) ? { tag: suche.tag } : {},
});
