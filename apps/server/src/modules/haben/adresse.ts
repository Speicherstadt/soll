/**
 * The address of a business's Haben as entered: `https://haben.example.de`, with or without a
 * trailing slash or `/api/v1` (docs/api.md: "Adresse: https://<deine Adresse>/api/v1"). Kept without
 * `/api/v1`, so the API's version stays Soll's business. Only http and https, no user, password,
 * query or fragment: the token goes in the header, never in the address. Null for anything else.
 */
export const adresseNormalisieren = (eingabe: string): string | null => {
  let url: URL;
  try {
    url = new URL(eingabe.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.search || url.hash) return null;
  const pfad = url.pathname.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
  return `${url.origin}${pfad}`;
};

/** Where the API of a Haben at the address answers */
export const apiBasis = (adresse: string): string => `${adresse}/api/v1`;
