/** Weber Haustechnik with accounts, for the tests of S-402 */
import { type Json, json, type Person } from "./monat-testhilfen.ts";

export { type Json, json, um } from "./monat-testhilfen.ts";

export const KONTEN = "/api/v1/arbeitszeit/konten";

export const konten = async (wer: Person, nutzerId?: string) =>
  json(await wer.anfrage(`${KONTEN}${nutzerId ? `?nutzerId=${nutzerId}` : ""}`));

export const hinweis = (wer: Person, fuer: Person, tag: string) =>
  wer.anfrage(`${KONTEN}/${fuer.nutzerId}/hinweise`, { body: { tag } });

export const anpassen = (wer: Person, fuer: Person, body: Json) =>
  wer.anfrage(`${KONTEN}/${fuer.nutzerId}/anpassungen`, { body: { grund: "Übernahme", ...body } });
