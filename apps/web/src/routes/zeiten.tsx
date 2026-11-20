import { createFileRoute } from "@tanstack/solid-router";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";

const Zeiten = () => (
  <Seite titel={m.nav_zeiten()}>
    <Leer text={m.seite_leer()} />
  </Seite>
);

export const Route = createFileRoute("/zeiten")({ component: Zeiten });
