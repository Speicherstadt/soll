import { createFileRoute } from "@tanstack/solid-router";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";

const Projekte = () => (
  <Seite titel={m.nav_projekte()}>
    <Leer text={m.seite_leer()} />
  </Seite>
);

export const Route = createFileRoute("/projekte")({ component: Projekte });
