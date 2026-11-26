import { Button } from "@soll/ui";
import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
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
  const agendaLink =
    "rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  return (
    <Seite titel={m.nav_einstellungen()}>
      <div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_210px] xl:items-start">
        <div class="flex min-w-0 flex-col gap-8">
          <div id="module" class="scroll-mt-6">
            <ModuleSchalter />
          </div>
          <div id="pruefung" class="scroll-mt-6">
            <PruefungEinstellungen />
          </div>
          <div id="bescheinigung" class="scroll-mt-6">
            <BescheinigungEinstellung />
          </div>
          <div id="erinnerungen" class="scroll-mt-6">
            <Erinnerungen />
          </div>
          <Show when={terminal()}>
            <div id="terminal" class="flex scroll-mt-6 flex-col gap-6">
              <TerminalGeraete />
              <TerminalPersonen />
              <TerminalKarten />
            </div>
          </Show>
          <div id="datev" class="scroll-mt-6">
            <DatevZuordnung />
          </div>
          <Show when={inhaber()}>
            <section id="umzug" class="flex scroll-mt-6 flex-col items-start gap-3">
              <h2 class="font-semibold">{m.umzug_titel()}</h2>
              <Link to="/umzug" class={knopfLink}>
                {m.umzug_link()}
              </Link>
            </section>
            <section id="verfahrensdoku" class="flex scroll-mt-6 flex-col items-start gap-3">
              <h2 class="font-semibold">{m.verfahrensdoku_titel()}</h2>
              <p class="text-muted-foreground">{m.verfahrensdoku_link_text()}</p>
              <Link to="/verfahrensdoku" class={knopfLink}>
                {m.verfahrensdoku_oeffnen()}
              </Link>
            </section>
          </Show>
          <div id="zugaenge" class="scroll-mt-6">
            <Zugaenge />
          </div>
          <section id="darstellung" class="flex max-w-sm scroll-mt-6 flex-col gap-3">
            <h2 class="font-semibold">{m.darstellung_titel()}</h2>
            <Darstellung />
          </section>
          <section id="konto" class="flex scroll-mt-6 flex-col items-start gap-3">
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
        </div>
        <nav
          aria-label={m.nav_einstellungen()}
          class="hidden flex-col gap-1 rounded-xl border border-border p-3 text-[13px] xl:sticky xl:top-6 xl:flex"
        >
          <a href="#module" class={agendaLink}>
            {m.module_titel()}
          </a>
          <a href="#pruefung" class={agendaLink}>
            {m.pruefung_titel()}
          </a>
          <a href="#bescheinigung" class={agendaLink}>
            {m.abw_einstellung_titel()}
          </a>
          <a href="#erinnerungen" class={agendaLink}>
            {m.erinnerungen_titel()}
          </a>
          <Show when={terminal()}>
            <a href="#terminal" class={agendaLink}>
              {m.terminal_titel()}
            </a>
          </Show>
          <a href="#datev" class={agendaLink}>
            {m.datev_titel()}
          </a>
          <Show when={inhaber()}>
            <a href="#umzug" class={agendaLink}>
              {m.umzug_titel()}
            </a>
            <a href="#verfahrensdoku" class={agendaLink}>
              {m.verfahrensdoku_titel()}
            </a>
          </Show>
          <a href="#zugaenge" class={agendaLink}>
            {m.zugaenge_titel()}
          </a>
          <a href="#darstellung" class={agendaLink}>
            {m.darstellung_titel()}
          </a>
          <a href="#konto" class={agendaLink}>
            {m.konto_titel()}
          </a>
        </nav>
      </div>
    </Seite>
  );
};

export const Route = createFileRoute("/einstellungen")({ component: Einstellungen });
