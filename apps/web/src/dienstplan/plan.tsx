import { plusTage, tagInBerlin } from "@soll/arbeitszeit";
import { createMemo, createSignal, Show, untrack } from "solid-js";
import { abfrage, aenderung, daten } from "../abfragen/abfrage.ts";
import { ressourcen } from "../abfragen/schluessel.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { istInhaber } from "../sitzung/ziel.ts";
import { type OffenerDialog, PlanDialoge } from "./dialoge.tsx";
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

/**
 * The plan of the sites of a business: the week of the site chosen (the first at the start), its
 * templates for whoever plans, the dialogs, the shift swap (S-504); read under the page's
 * `<Loading>`
 */
export const Plan = (props: { standorte: Standort[]; tag?: string | undefined }) => {
  const [standortId, setStandortId] = createSignal(() => props.standorte[0]?.standortId ?? "");
  // the week a link names, else this week; the plan's own arrows change it from there
  const [tag, setTag] = createSignal(untrack(() => props.tag) ?? tagInBerlin(Date.now()));
  const [offen, setOffen] = createSignal<OffenerDialog>(null);
  const [ansage, setAnsage] = createSignal("");
  const [fehler, setFehler] = createSignal("");
  const woche = abfrage<Woche>(() => ressourcen.woche({ standortId: standortId(), tag: tag() }));
  const geladen = () => daten(woche.data);
  // the templates are the planners' alone; everyone else is not asked for them
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
  // the week loads again after a drop, whether the server took it or not
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
  return (
    <>
      <PlanKopf
        woche={geladen() ?? null}
        standorte={props.standorte}
        standortId={standortId()}
        planer={istPlaner()}
        inhaber={istInhaberHier()}
        onWoche={(schritt) => setTag((alt) => plusTage(alt, 7 * schritt))}
        onStandort={setStandortId}
        onVorlagen={() => setOffen({ art: "vorlagen" })}
        onBedarf={() => setOffen({ art: "bedarf" })}
        onAngaben={() => setOffen({ art: "angaben" })}
        onKalender={() => setOffen({ art: "kalender" })}
        onRuf={() => setOffen({ art: "ruf", modus: { art: "neu", tag: tag() } })}
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
            onTag={setTag}
            onOeffnen={(schicht) =>
              setOffen({ art: "schicht", modus: { art: "bearbeiten", schicht } })
            }
            onNeu={(ziel) => setOffen({ art: "schicht", modus: { art: "neu", ziel } })}
            onRuf={(rufdienst) => setOffen({ art: "ruf", modus: { art: "bearbeiten", rufdienst } })}
            onAblegen={(was, ziel) => void ablegen(was, ziel)}
            ansagen={setAnsage}
          />
        )}
      </Show>
      <TauschBereich
        ich={{ nutzerId: aktuellerBetrieb()?.nutzerId ?? "", planer: istPlaner() }}
        inhaber={istInhaberHier()}
      />
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
    </>
  );
};
