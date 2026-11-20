import { createUniqueId } from "solid-js";
import { knopfLink } from "../einrichtung/stil.ts";
import { m } from "../paraglide/messages.js";

/** The Auskunft under Art. 15 DSGVO (S-309): everything Soll keeps about oneself, as JSON */
export const Auskunft = () => {
  const id = createUniqueId();
  return (
    <section class="flex max-w-3xl flex-col items-start gap-3" aria-labelledby={`${id}-titel`}>
      <h2 id={`${id}-titel`} class="font-semibold">
        {m.auskunft_titel()}
      </h2>
      <p class="text-muted-foreground">{m.auskunft_text()}</p>
      <a href="/api/v1/auskunft" download class={knopfLink}>
        {m.auskunft_herunterladen()}
      </a>
    </section>
  );
};
