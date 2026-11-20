import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";

/** The mark and name of the app above pages without the frame (design/mockup/Einrichtung.dc.html) */
export const Kopf = (props: { titel: string }) => (
  <header class="flex items-center gap-2.5">
    <span
      aria-hidden="true"
      class="flex size-8 items-center justify-center rounded-lg bg-primary font-bold text-[15px] text-primary-foreground"
    >
      {m.start_title().slice(0, 1)}
    </span>
    <span class="font-semibold text-[17px]">{props.titel}</span>
  </header>
);

/** A page without the frame: signing in, an invitation; one card on the muted surface */
export const KartenSeite = (props: { titel: string; children: JSX.Element }) => (
  <main class="flex min-h-dvh justify-center bg-muted px-4 py-12">
    <div class="flex w-full max-w-sm flex-col gap-6">
      <Kopf titel={m.start_title()} />
      <section class="flex flex-col gap-4 rounded-xl border border-border bg-background p-6">
        <h1 class="font-semibold text-[20px]">{props.titel}</h1>
        {props.children}
      </section>
    </div>
  </main>
);

/** An error of a form, read out when it appears */
export const Fehler = (props: { text: string }) => (
  <Show when={props.text}>
    <p role="alert" class="text-danger">
      {props.text}
    </p>
  </Show>
);
