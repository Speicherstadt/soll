import { type Tab, Tabs } from "@soll/ui";
import { createFileRoute } from "@tanstack/solid-router";
import { untrack } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Auftraege } from "../projekte/auftraege.tsx";
import { Kunden } from "../projekte/kunden.tsx";
import { projektQuelle } from "../projekte/quelle.ts";
import { Saetze } from "../projekte/saetze.tsx";
import { Taetigkeiten } from "../projekte/taetigkeiten.tsx";
import { Fehler } from "../rahmen/karte.tsx";
import { Seite } from "../rahmen/seite.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";

/** Owner and planner keep customers, orders, activities and rates (rollen.ts on the server) */
const verwaltet = () =>
  (aktuellerBetrieb()?.rolle ?? "")
    .split(",")
    .some((rolle) => ["inhaber", "planer"].includes(rolle.trim()));

/**
 * Projekte: orders and activities for everyone who books project time; customers and hourly rates
 * for owner and planner (S-601)
 */
const Projekte = () => {
  // the role as the session had it when the page opened: the root route loads it before any page
  const quelle = projektQuelle(untrack(verwaltet));
  const tabs: Tab[] = [
    {
      id: "auftraege",
      label: m.projekte_tab_auftraege(),
      inhalt: () => <Auftraege quelle={quelle} />,
    },
    ...(quelle.verwalten
      ? [{ id: "kunden", label: m.projekte_tab_kunden(), inhalt: () => <Kunden quelle={quelle} /> }]
      : []),
    {
      id: "taetigkeiten",
      label: m.projekte_tab_taetigkeiten(),
      inhalt: () => <Taetigkeiten quelle={quelle} />,
    },
    ...(quelle.verwalten
      ? [{ id: "saetze", label: m.projekte_tab_saetze(), inhalt: () => <Saetze quelle={quelle} /> }]
      : []),
  ];
  return (
    <Seite titel={m.nav_projekte()}>
      <Fehler text={quelle.fehler() ? m.laden_fehler() : ""} />
      <Tabs label={m.projekte_tabs()} tabs={tabs} />
    </Seite>
  );
};

export const Route = createFileRoute("/projekte")({ component: Projekte });
