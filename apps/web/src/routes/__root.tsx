import { createRootRoute, Outlet } from "@tanstack/solid-router";
import { Seitenleiste } from "../rahmen/seitenleiste.tsx";
import { TabLeiste } from "../rahmen/tabLeiste.tsx";

const Rahmen = () => (
  <div class="flex min-h-dvh">
    <Seitenleiste />
    <Outlet />
    <TabLeiste />
  </div>
);

export const Route = createRootRoute({ component: Rahmen });
