import { createFileRoute } from "@tanstack/solid-router";
import { m } from "../paraglide/messages.js";
import { Leer, Seite } from "../rahmen/seite.tsx";

const Heute = () => (
  <Seite titel={m.nav_heute()}>
    <Leer text={m.seite_leer()} />
  </Seite>
);

export const Route = createFileRoute("/")({ component: Heute });
