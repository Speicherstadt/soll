import type { IconNode } from "@soll/ui";
import {
  Briefcase,
  CalendarDays,
  ChartColumn,
  Clock,
  Ellipsis,
  Settings,
  Timer,
  TreePalm,
} from "lucide";
import { m } from "../paraglide/messages.js";

export type Bereich = {
  pfad:
    | "/"
    | "/zeiten"
    | "/abwesenheiten"
    | "/dienstplan"
    | "/projekte"
    | "/auswertungen"
    | "/einstellungen"
    | "/mehr";
  name: () => string;
  icon: IconNode;
};

/** The areas of the sidebar at the desktop, in the order of DESIGN.md ("Aufbau") */
export const BEREICHE: readonly Bereich[] = [
  { pfad: "/", name: () => m.nav_heute(), icon: Clock },
  { pfad: "/zeiten", name: () => m.nav_zeiten(), icon: Timer },
  { pfad: "/abwesenheiten", name: () => m.nav_abwesenheiten(), icon: TreePalm },
  { pfad: "/dienstplan", name: () => m.nav_dienstplan(), icon: CalendarDays },
  { pfad: "/projekte", name: () => m.nav_projekte(), icon: Briefcase },
  { pfad: "/auswertungen", name: () => m.nav_auswertungen(), icon: ChartColumn },
  { pfad: "/einstellungen", name: () => m.nav_einstellungen(), icon: Settings },
];

/** The tab bar on phones: Heute, Plan, Abwesenheit, Mehr (DESIGN.md, "Aufbau") */
export const TABS: readonly Bereich[] = [
  { pfad: "/", name: () => m.nav_heute(), icon: Clock },
  { pfad: "/dienstplan", name: () => m.nav_plan(), icon: CalendarDays },
  { pfad: "/abwesenheiten", name: () => m.nav_abwesenheit(), icon: TreePalm },
  { pfad: "/mehr", name: () => m.nav_mehr(), icon: Ellipsis },
];

/** What "Mehr" lists on a phone: every area the tab bar does not show */
export const MEHR: readonly Bereich[] = BEREICHE.filter(
  (bereich) => !TABS.some((tab) => tab.pfad === bereich.pfad),
);
