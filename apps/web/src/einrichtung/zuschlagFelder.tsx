import { Input } from "@soll/ui";
import { m } from "../paraglide/messages.js";
import { basispunkteAus } from "./werte.ts";

/** The rates the setup asks for; 0–4 Uhr, 25./26.12. and 1.5. follow night and holiday (S-207) */
const SAETZE = [
  { schluessel: "nacht", name: m.modell_zuschlag_nacht },
  { schluessel: "sonntag", name: m.modell_zuschlag_sonntag },
  { schluessel: "feiertag", name: m.modell_zuschlag_feiertag },
] as const;

/**
 * The surcharges of the form in basis points, or null when one is no percentage; an empty field
 * pays nothing
 */
export const zuschlaegeAus = (daten: FormData): Record<string, number> | null => {
  const saetze: Record<string, number> = {};
  for (const { schluessel } of SAETZE) {
    const text = String(daten.get(`zuschlag-${schluessel}`) ?? "").trim();
    if (text === "") continue;
    const wert = basispunkteAus(text);
    if (wert === null) return null;
    saetze[schluessel] = wert;
  }
  return saetze;
};

/** The surcharges of a model (§ 3b EStG), folded away: most models of a template pay none */
export const ZuschlagFelder = () => (
  <details class="flex flex-col gap-2">
    <summary class="cursor-pointer font-medium">{m.modell_zuschlaege()}</summary>
    <p class="mt-2 text-[12px] text-muted-foreground">{m.modell_zuschlaege_hinweis()}</p>
    <div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {SAETZE.map(({ schluessel, name }) => (
        <Input label={name()} name={`zuschlag-${schluessel}`} inputmode="decimal" />
      ))}
    </div>
  </details>
);
