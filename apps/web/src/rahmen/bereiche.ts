import type { Module } from "@soll/arbeitszeit";
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
import { sichtbar, tabPfade } from "./module.ts";

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
const BEREICHE: readonly Bereich[] = [
  { pfad: "/", name: () => m.nav_heute(), icon: Clock },
  { pfad: "/zeiten", name: () => m.nav_zeiten(), icon: Timer },
  { pfad: "/abwesenheiten", name: () => m.nav_abwesenheiten(), icon: TreePalm },
  { pfad: "/dienstplan", name: () => m.nav_dienstplan(), icon: CalendarDays },
  { pfad: "/projekte", name: () => m.nav_projekte(), icon: Briefcase },
  { pfad: "/auswertungen", name: () => m.nav_auswertungen(), icon: ChartColumn },
  { pfad: "/einstellungen", name: () => m.nav_einstellungen(), icon: Settings },
];

/** The areas a tab on a phone may take, with their short names (DESIGN.md, "Aufbau") */
const TABS: readonly Bereich[] = [
  { pfad: "/", name: () => m.nav_heute(), icon: Clock },
  { pfad: "/dienstplan", name: () => m.nav_plan(), icon: CalendarDays },
  { pfad: "/abwesenheiten", name: () => m.nav_abwesenheit(), icon: TreePalm },
  { pfad: "/projekte", name: () => m.nav_projekte(), icon: Briefcase },
  { pfad: "/zeiten", name: () => m.nav_zeiten(), icon: Timer },
  { pfad: "/mehr", name: () => m.nav_mehr(), icon: Ellipsis },
];

/** The sidebar: the areas of the modules the business uses */
export const bereicheFuer = (module: Module): Bereich[] =>
  BEREICHE.filter((bereich) => sichtbar(module, bereich.pfad));

/** The tab bar: Heute, two areas of the modules, Mehr */
export const tabsFuer = (module: Module): Bereich[] => {
  const pfade = tabPfade(module);
  return TABS.filter((tab) => pfade.includes(tab.pfad));
};

/** What "Mehr" lists on a phone: every area of the modules the tab bar does not show */
export const mehrFuer = (module: Module): Bereich[] => {
  const pfade = tabPfade(module);
  return bereicheFuer(module).filter((bereich) => !pfade.includes(bereich.pfad));
};
