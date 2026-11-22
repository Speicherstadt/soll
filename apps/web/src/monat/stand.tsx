import { Badge, Icon } from "@soll/ui";
import { Check } from "lucide";
import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { datumText } from "./text.ts";
import type { MonatAnsicht } from "./typen.ts";

/** What closing did with the time sheet's mail, in words */
export const MAIL: Record<string, () => string> = {
  gesendet: () => m.monat_mail_gesendet(),
  keine_adresse: () => m.monat_mail_keine_adresse(),
  fehler: () => m.monat_mail_fehler(),
  nicht_eingerichtet: () => m.monat_mail_nicht_eingerichtet(),
};

/** Where a month stands, in words: confirmed by the person, closed by the business */
export const Stand = (props: { ansicht: MonatAnsicht }) => (
  <Show when={props.ansicht.ausgesondert} fallback={<Schritte ansicht={props.ansicht} />}>
    {(ausgesondert) => (
      <Badge>{m.monat_ausgesondert({ datum: datumText(ausgesondert().am) })}</Badge>
    )}
  </Show>
);

/** The steps of a month whose content is still there */
const Schritte = (props: { ansicht: MonatAnsicht }) => (
  <div class="flex flex-wrap items-center gap-2">
    <Show when={props.ansicht.bestaetigung} fallback={<Badge>{m.monat_nicht_bestaetigt()}</Badge>}>
      {(bestaetigung) => (
        <Show
          when={bestaetigung().gueltig}
          fallback={<Badge ton="warning">{m.monat_bestaetigung_veraltet()}</Badge>}
        >
          <Badge ton="success">
            <Icon icon={Check} size={14} />
            {m.monat_bestaetigt({
              name: bestaetigung().vonName,
              datum: datumText(bestaetigung().am),
            })}
          </Badge>
        </Show>
      )}
    </Show>
    <Show when={props.ansicht.abschluss} fallback={<Badge>{m.monat_betrieb_offen()}</Badge>}>
      {(abschluss) => (
        <Badge ton="success">
          <Icon icon={Check} size={14} />
          {m.monat_abgeschlossen({ name: abschluss().vonName, datum: datumText(abschluss().am) })}
        </Badge>
      )}
    </Show>
  </div>
);
