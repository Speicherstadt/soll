import { Button } from "@soll/ui";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import { api } from "../api.ts";
import { ModuleSchalter } from "../einstellungen/moduleSchalter.tsx";
import { PruefungEinstellungen } from "../einstellungen/pruefung.tsx";
import { m } from "../paraglide/messages.js";
import { Darstellung } from "../rahmen/darstellung.tsx";
import { Fehler } from "../rahmen/karte.tsx";
import { Seite } from "../rahmen/seite.tsx";
import { abgemeldet, sitzungNeu } from "../sitzung/sitzung.ts";

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
  return (
    <Seite titel={m.nav_einstellungen()}>
      <ModuleSchalter />
      <PruefungEinstellungen />
      <section class="flex max-w-sm flex-col gap-3">
        <h2 class="font-semibold">{m.darstellung_titel()}</h2>
        <Darstellung />
      </section>
      <section class="flex max-w-sm flex-col items-start gap-3">
        <h2 class="font-semibold">{m.konto_titel()}</h2>
        <Button variant="outline" onClick={abmelden}>
          {m.abmelden()}
        </Button>
        <Fehler text={fehler()} />
      </section>
    </Seite>
  );
};

export const Route = createFileRoute("/einstellungen")({ component: Einstellungen });
