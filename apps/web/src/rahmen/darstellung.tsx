import { createSignal, createUniqueId, For } from "solid-js";
import { m } from "../paraglide/messages.js";
import { getLocale, type Locale, locales, setLocale } from "../paraglide/runtime.js";
import { liesThema, speichereThema, THEMEN, type Thema, wendeThemaAn } from "./theme.ts";

const ablage = (): Storage | undefined => {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
};

const themaName = (thema: Thema): string =>
  thema === "hell" ? m.theme_hell() : thema === "dunkel" ? m.theme_dunkel() : m.theme_system();

/** Each language under its own name ("Deutsch", "Türkçe", "العربية"), from the browser's Intl */
const sprachName = (locale: Locale): string =>
  new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;

// Tailwind 4: outline-none would also set the outline style that focus-visible:outline-2 relies on
const feld =
  "h-9 w-full rounded-md border border-border bg-background px-2 outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-foreground";

// One theme for every picker: the sidebar and the page show the same choice. Module scope is fine
// in this client-only SPA (CLAUDE.md: no SSR).
const [thema, setThema] = createSignal(liesThema(ablage()));

/** Colours and language, at the foot of the sidebar and under "Mehr" on phones */
export const Darstellung = () => {
  const themaId = createUniqueId();
  const spracheId = createUniqueId();
  return (
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <label for={themaId} class="text-[12px] text-muted-foreground">
          {m.theme_label()}
        </label>
        <select
          id={themaId}
          class={feld}
          value={thema()}
          onChange={(event) => {
            const neu = event.currentTarget.value as Thema;
            setThema(neu);
            speichereThema(ablage(), neu);
            wendeThemaAn(document.documentElement, neu);
          }}
        >
          <For each={THEMEN}>{(wert) => <option value={wert}>{themaName(wert)}</option>}</For>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label for={spracheId} class="text-[12px] text-muted-foreground">
          {m.sprache_label()}
        </label>
        <select
          id={spracheId}
          class={feld}
          value={getLocale()}
          onChange={(event) => setLocale(event.currentTarget.value as Locale)}
        >
          <For each={locales}>
            {(locale) => (
              <option value={locale} lang={locale}>
                {sprachName(locale)}
              </option>
            )}
          </For>
        </select>
      </div>
    </div>
  );
};
