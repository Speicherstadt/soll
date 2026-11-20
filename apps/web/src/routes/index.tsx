import { createFileRoute } from "@tanstack/solid-router";
import { m } from "../paraglide/messages.js";

const Start = () => (
  <main class="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-3 px-6">
    <h1 class="font-semibold text-[28px] tracking-tight">{m.start_title()}</h1>
    <p class="text-muted-foreground">{m.start_tagline()}</p>
    <p class="w-fit rounded-sm bg-warning-surface px-2 py-0.5 text-[12px] text-warning">
      {m.start_status()}
    </p>
  </main>
);

export const Route = createFileRoute("/")({ component: Start });
