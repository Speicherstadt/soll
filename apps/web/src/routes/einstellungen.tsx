import { Button } from "@soll/ui";
import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import { api } from "../api.ts";
import { DatevZuordnung } from "../datev/zuordnung.tsx";
import { knopfLink } from "../einrichtung/stil.ts";
import { BescheinigungEinstellung } from "../einstellungen/bescheinigung.tsx";
import { ModuleSchalter } from "../einstellungen/moduleSchalter.tsx";
import { PruefungEinstellungen } from "../einstellungen/pruefung.tsx";
import { SollquelleEinstellung } from "../einstellungen/sollquelle.tsx";
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
  return (
    <Seite titel={m.nav_einstellungen()}>
      <ModuleSchalter />
      <PruefungEinstellungen />
      <BescheinigungEinstellung />
      <SollquelleEinstellung />
      <Erinnerungen />
      <Show when={terminal()}>
        <TerminalGeraete />
        <TerminalPersonen />
        <TerminalKarten />
      </Show>
      <DatevZuordnung />
      <Show when={inhaber()}>
        <section class="flex max-w-sm flex-col items-start gap-3">
          <h2 class="font-semibold">{m.umzug_titel()}</h2>
          <Link to="/umzug" class={knopfLink}>
            {m.umzug_link()}
          </Link>
        </section>
        <section class="flex max-w-lg flex-col items-start gap-3">
          <h2 class="font-semibold">{m.verfahrensdoku_titel()}</h2>
          <p class="text-muted-foreground">{m.verfahrensdoku_link_text()}</p>
          <Link to="/verfahrensdoku" class={knopfLink}>
            {m.verfahrensdoku_oeffnen()}
          </Link>
        </section>
      </Show>
      <Zugaenge />
      <section class="flex max-w-sm flex-col gap-3">
        <h2 class="font-semibold">{m.darstellung_titel()}</h2>
        <Darstellung />
      </section>
      <section class="flex max-w-sm flex-col items-start gap-3">
        <h2 class="font-semibold">{m.konto_titel()}</h2>
        <Link to="/export" class={knopfLink}>
          {m.auskunft_titel()}
        </Link>
        <Button variant="outline" onClick={abmelden}>
          {m.abmelden()}
        </Button>
        <Fehler text={fehler()} />
      </section>
    </Seite>
  );
};

export const Route = createFileRoute("/einstellungen")({ component: Einstellungen });
