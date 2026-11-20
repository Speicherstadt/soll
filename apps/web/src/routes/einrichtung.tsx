import { fragenAusModulen, moduleAusFragen } from "@soll/arbeitszeit";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal, Match, onSettled, Switch, untrack } from "solid-js";
import { api } from "../api.ts";
import { type Antworten, BetriebSchritt } from "../einrichtung/betriebSchritt.tsx";
import { type Einladung, EinladungenSchritt } from "../einrichtung/einladungenSchritt.tsx";
import { Geruest } from "../einrichtung/geruest.tsx";
import { MitarbeiterSchritt, type Person } from "../einrichtung/mitarbeiterSchritt.tsx";
import { ModelleSchritt } from "../einrichtung/modelleSchritt.tsx";
import { schritteFuer } from "../einrichtung/schritte.ts";
import { StandorteSchritt } from "../einrichtung/standorteSchritt.tsx";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { aktuellerBetrieb, sitzungNeu } from "../sitzung/sitzung.ts";

/**
 * The setup assistant (BAULISTE.md S-303): the business and four questions, then, for a business with
 * employees, sites, working-time models, people and invitations. Each step saves on "Weiter", so a
 * setup left halfway goes on where the server stands.
 */
const OFFEN = { beschaeftigte: true, schichten: false, kunden: false, stempelort: false };

const Einrichtung = () => {
  const navigate = useNavigate();
  const betrieb = aktuellerBetrieb;
  // the answers as the server left them, read once: from here on the person changes them
  const bisher = untrack(betrieb);
  // answered before if the first step was saved (the Land is set then)
  const [antworten, setAntworten] = createSignal<Antworten>(
    bisher?.land ? fragenAusModulen(bisher.module) : {},
  );
  // until a question is answered, the steps of a business with employees show
  const module = () => moduleAusFragen({ ...OFFEN, ...antworten() });
  const schritte = () => schritteFuer(module());
  const [index, setIndex] = createSignal(0);
  const [personen, setPersonen] = createSignal<Person[]>([]);
  // the links are shown once only, so they outlive the step: back and on again, they are still there
  const [einladungen, setEinladungen] = createSignal<Einladung[]>([]);
  const [fehler, setFehler] = createSignal("");
  // the list and the links live only in this page: a reload or a closed tab asks first
  const warnen = (event: BeforeUnloadEvent) => {
    if (personen().length > 0 || einladungen().length > 0) event.preventDefault();
  };
  onSettled(() => {
    window.addEventListener("beforeunload", warnen);
    return () => window.removeEventListener("beforeunload", warnen);
  });
  const zurueck = () => setIndex((i) => Math.max(0, i - 1));
  const weiter = async () => {
    if (index() < schritte().length - 1) return setIndex((i) => i + 1);
    const antwort = await api("/api/v1/einrichtung/abschliessen", { method: "POST", body: {} });
    if (!antwort.ok)
      return setFehler(antwort.status === 0 ? m.fehler_netz() : m.fehler_speichern());
    setFehler("");
    await sitzungNeu();
    await navigate({ to: "/" });
  };
  const stand = () => ({
    nummer: index() + 1,
    anzahl: schritte().length,
    zurueck: index() > 0 ? zurueck : undefined,
    weiter,
  });
  return (
    <Geruest schritte={schritte()} aktuell={index()} module={module()} titelId="schritt-titel">
      <Switch>
        <Match when={schritte()[index()] === "betrieb"}>
          <BetriebSchritt
            betrieb={betrieb()}
            antworten={antworten()}
            setzeAntworten={setAntworten}
            module={module()}
            {...stand()}
          />
        </Match>
        <Match when={schritte()[index()] === "standorte"}>
          <StandorteSchritt land={betrieb()?.land ?? "HH"} {...stand()} />
        </Match>
        <Match when={schritte()[index()] === "arbeitszeit"}>
          <ModelleSchritt {...stand()} />
        </Match>
        <Match when={schritte()[index()] === "mitarbeiter"}>
          <MitarbeiterSchritt personen={personen()} setzePersonen={setPersonen} {...stand()} />
        </Match>
        <Match when={schritte()[index()] === "einladungen"}>
          <EinladungenSchritt
            personen={personen()}
            setzePersonen={setPersonen}
            einladungen={einladungen()}
            setzeEinladungen={setEinladungen}
            {...stand()}
          />
        </Match>
      </Switch>
      <Fehler text={fehler()} />
    </Geruest>
  );
};

export const Route = createFileRoute("/einrichtung")({ component: Einrichtung });
