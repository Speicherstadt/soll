import { Button } from "@soll/ui";
import { createSignal, createUniqueId } from "solid-js";
import { feld } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";
import { Fehler, KartenSeite } from "../rahmen/karte.tsx";
import { codeAnzeige } from "./eingabe.ts";
import type { Meldung } from "./meldung.ts";
import { meldungText } from "./text.ts";

/**
 * Pairing (S-801): the tablet takes the one-time code the owner created under Einstellungen and
 * trades it for its device token; until then it can do nothing else
 */
export const Koppeln = (props: {
  onKoppeln: (code: string) => Promise<Meldung | "code_ungueltig" | null>;
}) => {
  const id = createUniqueId();
  const [code, setCode] = createSignal("");
  const [fehler, setFehler] = createSignal("");
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const ergebnis = await props.onKoppeln(code());
    if (ergebnis === null) return;
    setFehler(
      ergebnis === "code_ungueltig" ? m.kiosk_code_ungueltig() : meldungText(ergebnis, Date.now()),
    );
  };
  return (
    <KartenSeite titel={m.kiosk_koppeln_titel()}>
      <p class="text-muted-foreground">{m.kiosk_koppeln_text()}</p>
      <form class="flex flex-col gap-4" onSubmit={absenden}>
        <div class="flex flex-col gap-1.5">
          <label for={`${id}-code`} class="font-medium">
            {m.kiosk_code()}
          </label>
          <input
            id={`${id}-code`}
            class={`${feld} h-14 font-mono text-[24px] uppercase tracking-widest`}
            autocomplete="off"
            autocapitalize="characters"
            spellcheck={false}
            maxlength={9}
            required
            value={code()}
            onInput={(event) => setCode(codeAnzeige(event.currentTarget.value))}
          />
        </div>
        <Fehler text={fehler()} />
        <Button type="submit" size="lg">
          {m.kiosk_koppeln()}
        </Button>
      </form>
    </KartenSeite>
  );
};
