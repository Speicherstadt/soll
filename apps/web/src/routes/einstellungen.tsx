import type { JSX } from "@solidjs/web";
import { Button, type Tab, Tabs } from "@soll/ui";
import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { createMemo, createSignal, Show } from "solid-js";
import { api } from "../api.ts";
import { DatevZuordnung } from "../datev/zuordnung.tsx";
import { knopfLink } from "../einrichtung/stil.ts";
import { BescheinigungEinstellung } from "../einstellungen/bescheinigung.tsx";
import { ModuleSchalter } from "../einstellungen/moduleSchalter.tsx";
import { PruefungEinstellungen } from "../einstellungen/pruefung.tsx";
import { TerminalGeraete } from "../einstellungen/terminalGeraete.tsx";
import { TerminalKarten } from "../einstellungen/terminalKarten.tsx";
import { TerminalPersonen } from "../einstellungen/terminalPersonen.tsx";
import { Erinnerungen } from "../erinnerungen/erinnerungen.tsx";
import { m } from "../paraglide/messages.js";
import { Darstellung } from "../rahmen/darstellung.tsx";
import { Fehler } from "../rahmen/karte.tsx";
import { Seite } from "../rahmen/seite.tsx";
import { abgemeldet, aktuellerBetrieb, sitzungNeu } from "../sitzung/sitzung.ts";
import { istInhaber } from "../sitzung/ziel.ts";
import { Zugaenge } from "../zugaenge/zugaenge.tsx";

const TAB_SPEICHER = "soll.einstellungen.tab";

const tabLesen = (): string | undefined => {
  try {
    return sessionStorage.getItem(TAB_SPEICHER) ?? undefined;
  } catch {
    return undefined;
  }
};

const tabSchreiben = (id: string) => {
  try {
    sessionStorage.setItem(TAB_SPEICHER, id);
  } catch {
    // storage may be blocked in private/restricted browsers
  }
};

const Karte = (props: { children: JSX.Element; voll?: boolean }) => (
  <div
    class={`flex h-full min-w-0 flex-col rounded-xl border border-border bg-background p-5 ${
      props.voll ? "lg:col-span-2" : ""
    }`}
  >
    {props.children}
  </div>
);

const Einstellungen = () => {
  const navigate = useNavigate();
  const [fehler, setFehler] = createSignal("");
  const abmelden = async () => {
    const antwort = await api("/api/auth/sign-out", { body: {} });
    // without an answer the session may still be alive: the sign-in page would only pretend
    if (antwort.status === 0) return setFehler(m.fehler_netz());
    // a refusal (or a second click after the first one ended it): the server says whether it lives
    if (antwort.ok) abgemeldet();
    else if ((await sitzungNeu()).art !== "abgemeldet") return setFehler(m.fehler_abmelden());
    setFehler("");
    await navigate({ to: "/anmelden" });
  };

  // the move from other tools writes everyone's records (S-701), and the Verfahrensdokumentation
  // describes the business's procedure (S-902): both the owner's
  const inhaber = () => {
    const betrieb = aktuellerBetrieb();
    return betrieb ? istInhaber(betrieb) : false;
  };
  // the terminal is the owner's: pairing tablets, PINs, QR codes (S-801) and NFC cards (S-802)
  const terminal = () => {
    const betrieb = aktuellerBetrieb();
    if (!betrieb?.module.terminal) return false;
    return istInhaber(betrieb);
  };
  const hatRolle = (...rollen: string[]) =>
    (aktuellerBetrieb()?.rolle ?? "").split(",").some((rolle) => rollen.includes(rolle.trim()));
  const arbeitszeit = () => Boolean(aktuellerBetrieb()?.module.arbeitszeit);
  const erinnerungenSichtbar = () => arbeitszeit() && hatRolle("inhaber", "planer", "mitarbeiter");
  const datevSichtbar = () => hatRolle("inhaber", "lohnbuero");

  // Stable Tab object references so <For> in Tabs never remounts active tabpanels on session refresh
  const betriebTab: Tab = {
    id: "betrieb",
    label: m.einstellungen_tab_betrieb(),
    inhalt: () => (
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
        <Karte>
          <ModuleSchalter />
        </Karte>
        <Show when={inhaber()}>
          <Karte>
            <PruefungEinstellungen />
          </Karte>
        </Show>
        <Show when={inhaber() && arbeitszeit()}>
          <Karte>
            <BescheinigungEinstellung />
          </Karte>
        </Show>
        <Show when={erinnerungenSichtbar()}>
          <Karte>
            <Erinnerungen />
          </Karte>
        </Show>
      </div>
    ),
  };

  const terminalTab: Tab = {
    id: "terminal",
    label: m.einstellungen_tab_terminal(),
    inhalt: () => (
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
        <Karte>
          <TerminalGeraete />
        </Karte>
        <Karte>
          <TerminalPersonen />
        </Karte>
        <Karte voll>
          <TerminalKarten />
        </Karte>
      </div>
    ),
  };

  const exportTab: Tab = {
    id: "export",
    label: m.einstellungen_tab_export(),
    inhalt: () => (
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
        <Show when={datevSichtbar()}>
          <Karte voll>
            <DatevZuordnung />
          </Karte>
        </Show>
        <Show when={inhaber()}>
          <Karte>
            <section class="flex flex-col items-start gap-3">
              <h2 class="font-semibold">{m.umzug_titel()}</h2>
              <Link to="/umzug" class={knopfLink}>
                {m.umzug_link()}
              </Link>
            </section>
          </Karte>
          <Karte>
            <section class="flex flex-col items-start gap-3">
              <h2 class="font-semibold">{m.verfahrensdoku_titel()}</h2>
              <p class="text-muted-foreground">{m.verfahrensdoku_link_text()}</p>
              <Link to="/verfahrensdoku" class={knopfLink}>
                {m.verfahrensdoku_oeffnen()}
              </Link>
            </section>
          </Karte>
        </Show>
      </div>
    ),
  };

  const kontoTab: Tab = {
    id: "konto",
    label: m.einstellungen_tab_konto(),
    inhalt: () => (
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
        <Karte voll>
          <Zugaenge />
        </Karte>
        <Karte>
          <section class="flex max-w-sm flex-col gap-3">
            <h2 class="font-semibold">{m.darstellung_titel()}</h2>
            <Darstellung />
          </section>
        </Karte>
        <Karte>
          <section class="flex flex-col items-start gap-3">
            <h2 class="font-semibold">{m.konto_titel()}</h2>
            <div class="flex flex-wrap gap-2">
              <Link to="/export" class={knopfLink}>
                {m.auskunft_titel()}
              </Link>
              <Button variant="outline" onClick={abmelden}>
                {m.abmelden()}
              </Button>
            </div>
            <Fehler text={fehler()} />
          </section>
        </Karte>
      </div>
    ),
  };

  const tabs = createMemo<Tab[]>(() => {
    const liste: Tab[] = [betriebTab];
    if (terminal()) liste.push(terminalTab);
    if (datevSichtbar() || inhaber()) liste.push(exportTab);
    liste.push(kontoTab);
    return liste;
  });

  return (
    <Seite titel={m.nav_einstellungen()}>
      <Tabs
        label={m.nav_einstellungen()}
        tabs={tabs()}
        start={tabLesen()}
        onWechsel={tabSchreiben}
      />
    </Seite>
  );
};

export const Route = createFileRoute("/einstellungen")({ component: Einstellungen });
