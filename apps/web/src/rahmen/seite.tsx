import type { JSX } from "@solidjs/web";
import { AuswertungHinweis } from "../auslastung/hinweis.tsx";
import { PflichtHinweis } from "./pflichtHinweis.tsx";

/**
 * A page with its title; the main content of the app, one per route. A title made of loaded data
 * brings its own `<Loading>` with the plain title as fallback. Below the title, on every page, what
 * Soll tells the owner about a change it made by itself (S-603), and to everyone that the
 * utilisation per person is switched on (S-604).
 */
export const Seite = (props: { titel: JSX.Element; children: JSX.Element }) => (
  <main class="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-6 pb-24 md:px-8 md:pb-6">
    <h1 class="font-bold text-[28px] tracking-tight md:font-semibold md:text-[22px]">
      {props.titel}
    </h1>
    <PflichtHinweis />
    <AuswertungHinweis />
    {props.children}
  </main>
);

/** The content of an area that is not built yet */
export const Leer = (props: { text: string }) => <p class="text-muted-foreground">{props.text}</p>;
