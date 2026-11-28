import { createSignal } from "solid-js";

const TAB_SPEICHER = "soll.einstellungen.tab";

const tabLesen = (): string | undefined => {
  try {
    return sessionStorage.getItem(TAB_SPEICHER) ?? undefined;
  } catch {
    return undefined;
  }
};

const [einstellungenTab, setEinstellungenTab] = createSignal<string | undefined>(tabLesen());

export { einstellungenTab };

/** Remembers and activates a settings tab across the session and direct navigation */
export const einstellungenTabSetzen = (id: string) => {
  setEinstellungenTab(id);
  try {
    sessionStorage.setItem(TAB_SPEICHER, id);
  } catch {
    // storage may be blocked in private/restricted browsers
  }
};
