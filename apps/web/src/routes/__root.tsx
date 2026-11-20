import { createRootRoute, Outlet, redirect, useLocation } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { Seitenleiste } from "../rahmen/seitenleiste.tsx";
import { TabLeiste } from "../rahmen/tabLeiste.tsx";
import { sitzungLaden } from "../sitzung/sitzung.ts";
import { EINRICHTUNG, OFFEN, zielFuer } from "../sitzung/ziel.ts";

/** Pages without the app's frame: signing in, the setup and an invitation (design/mockup) */
const ohneRahmen = (pfad: string) =>
  OFFEN.includes(pfad) || pfad === EINRICHTUNG || pfad.startsWith("/einladung/");

const Rahmen = () => {
  const ort = useLocation();
  return (
    <Show when={!ohneRahmen(ort().pathname)} fallback={<Outlet />}>
      <div class="flex min-h-dvh">
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
    const ziel = zielFuer(await sitzungLaden(), location.pathname);
    if (ziel && ziel !== location.pathname) throw redirect({ to: ziel as "/" });
  },
});
