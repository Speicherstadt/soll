import { createRootRoute, Outlet, redirect, useLocation } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Seitenleiste } from "../rahmen/seitenleiste.tsx";
import { TabLeiste } from "../rahmen/tabLeiste.tsx";
import { sitzungLaden } from "../sitzung/sitzung.ts";
import { EINRICHTUNG, OFFEN, PRUEFSEITE, TERMINAL, zielFuer } from "../sitzung/ziel.ts";

/** Pages without the app's frame: signing in, the setup, an invitation, the check page, the terminal */
const ohneRahmen = (pfad: string) =>
  OFFEN.includes(pfad) ||
  pfad === EINRICHTUNG ||
  pfad === PRUEFSEITE ||
  pfad === TERMINAL ||
  pfad.startsWith("/einladung/");

const Rahmen = () => {
  const ort = useLocation();
  return (
    <Show when={!ohneRahmen(ort().pathname)} fallback={<Outlet />}>
      <div class="flex min-h-dvh">
        <a
          href="#main"
          class="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:font-medium focus:text-primary-foreground focus:outline-2 focus:outline-foreground focus:outline-offset-2"
        >
          {m.nav_zum_inhalt()}
        </a>
        <Seitenleiste />
        <Outlet />
        <TabLeiste />
      </div>
    </Show>
  );
};

export const Route = createRootRoute({
  component: Rahmen,
  // Leads to the sign-in, the setup or away from a switched-off module before a page renders; the
  // server refuses those routes anyway, this only spares a page that cannot work
  beforeLoad: async ({ location }) => {
    // the terminal has no session to ask about (S-801)
    if (location.pathname === TERMINAL) return;
    const ziel = zielFuer(await sitzungLaden(), location.pathname);
    if (ziel && ziel !== location.pathname) throw redirect({ to: ziel as "/" });
  },
});
