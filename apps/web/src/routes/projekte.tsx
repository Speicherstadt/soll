import { type Tab, Tabs } from "@soll/ui";
import { createFileRoute } from "@tanstack/solid-router";
import { Loading, untrack } from "solid-js";
import { Haben } from "../haben/haben.tsx";
import { m } from "../paraglide/messages.js";
import { Auftraege } from "../projekte/auftraege.tsx";
import { Kunden } from "../projekte/kunden.tsx";
import { projektQuelle } from "../projekte/quelle.ts";
import { Saetze } from "../projekte/saetze.tsx";
import { Taetigkeiten } from "../projekte/taetigkeiten.tsx";
import { ProjekteUebersicht } from "../projekte/uebersicht.tsx";
import { Fehler } from "../rahmen/karte.tsx";
import { Seite } from "../rahmen/seite.tsx";
import { aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { Stundennachweise } from "../stundennachweis/nachweise.tsx";

const hatRolle = (...rollen: string[]) =>
  (aktuellerBetrieb()?.rolle ?? "").split(",").some((rolle) => rollen.includes(rolle.trim()));

/** Owner and planner keep customers, orders, activities and rates (rollen.ts on the server) */
const verwaltet = () => hatRolle("inhaber", "planer");

/**
 * Projekte: orders and activities for everyone who books project time; customers and hourly rates
 * for owner and planner (S-601); the Stundennachweis for everyone who books (S-605); the link to
 * Haben for owner and planner, its access for the owner (S-606)
 */
const Projekte = () => {
  // the role as the session had it when the page opened: the root route loads it before any page
  const quelle = projektQuelle(untrack(verwaltet));
  const inhaber = untrack(() => hatRolle("inhaber"));
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
    {
      id: "nachweise",
      label: m.projekte_tab_nachweise(),
      inhalt: () => <Stundennachweise projekte={quelle} />,
    },
    ...(quelle.verwalten
      ? [
          {
            id: "haben",
            label: m.projekte_tab_haben(),
            inhalt: () => <Haben projekte={quelle} inhaber={inhaber} />,
          },
        ]
      : []),
  ];
  return (
    <Seite titel={m.nav_projekte()}>
      <Loading>
        <Fehler text={quelle.fehler() ? m.laden_fehler() : ""} />
        <ProjekteUebersicht quelle={quelle} />
        <Tabs label={m.projekte_tabs()} tabs={tabs} />
      </Loading>
    </Seite>
  );
};

export const Route = createFileRoute("/projekte")({ component: Projekte });
