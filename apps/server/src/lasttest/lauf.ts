import type { Messung } from "./auswertung.ts";

/**
 * The load test's run (BAULISTE.md S-904): businesses and people are set up through the app's own
 * HTTP API, as the owner and the invited people would do it in the browser (sign-up, organization,
 * invitation list, accepting, sign-in), then every person stamps "kommen" at the same moment.
 */

/** A fetch: the real server over the network, or the app in the same process (the small test) */
export type Holen = (url: string, init: RequestInit) => Promise<Response>;

export type LastAngaben = {
  /** the server's origin, also sent as Origin for Better Auth's check */
  url: string;
  holen: Holen;
  betriebe: number;
  personen: number;
  /** how many businesses are set up at the same time; the stamps themselves all start at once */
  gleichzeitig: number;
};

export type Person = { betriebId: string; nutzerId: string; anfrage: Anfrage };
export type Ergebnis = { betriebIds: string[]; personen: Person[]; messungen: Messung[] };

type Anfrage = (pfad: string, body?: unknown) => Promise<Response>;

export const STEMPELN = "/api/v1/arbeitszeit/stempelungen";
const PASSWORT = "lasttest-geheim-123";

/** A browser of one person: keeps its session cookie between calls */
const browser = ({ url, holen }: Pick<LastAngaben, "url" | "holen">): Anfrage => {
  let cookie = "";
  return async (pfad, body) => {
    const antwort = await holen(`${url}${pfad}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        origin: url,
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const gesetzt = antwort.headers.getSetCookie();
    if (gesetzt.length > 0) cookie = gesetzt.map((zeile) => zeile.split(";")[0]).join("; ");
    return antwort;
  };
};

/** Calls and fails loudly unless the answer has the expected status */
const erwarten = async <T>(
  anfrage: Anfrage,
  pfad: string,
  body: unknown,
  status: number,
): Promise<T> => {
  const antwort = await anfrage(pfad, body);
  if (antwort.status !== status) {
    throw new Error(`${pfad}: ${antwort.status} ${await antwort.text()}`);
  }
  return (await antwort.json()) as T;
};

/** The owner signs up, creates the business and makes it active */
const inhaberMitBetrieb = async (angaben: LastAngaben, nummer: number) => {
  const anfrage = browser(angaben);
  const slug = `lasttest-${nummer}`;
  await erwarten(
    anfrage,
    "/api/auth/sign-up/email",
    { email: `${slug}@lasttest.test`, password: PASSWORT, name: `Inhaber ${nummer}` },
    200,
  );
  const { id } = await erwarten<{ id: string }>(
    anfrage,
    "/api/auth/organization/create",
    { name: `Betrieb ${nummer}`, slug },
    200,
  );
  await erwarten(anfrage, "/api/auth/organization/set-active", { organizationId: id }, 200);
  return { anfrage, betriebId: id };
};

/** An invited person accepts the link, signs in with the username and makes the business active */
const annehmen = async (
  angaben: LastAngaben,
  betriebId: string,
  link: string,
  benutzername: string,
): Promise<Person> => {
  const anfrage = browser(angaben);
  const token = link.split("/einladung/")[1] ?? "";
  const { nutzerId } = await erwarten<{ nutzerId: string }>(
    anfrage,
    `/api/v1/einladung/${token}/annehmen`,
    { benutzername, passwort: PASSWORT },
    201,
  );
  await erwarten(
    anfrage,
    "/api/auth/sign-in/username",
    { username: benutzername, password: PASSWORT },
    200,
  );
  await erwarten(anfrage, "/api/auth/organization/set-active", { organizationId: betriebId }, 200);
  return { betriebId, nutzerId, anfrage };
};

/** One business with its people, all employees who may stamp */
const betriebAufbauen = async (angaben: LastAngaben, nummer: number) => {
  const inhaber = await inhaberMitBetrieb(angaben, nummer);
  const namen = Array.from({ length: angaben.personen }, (_, i) => `b${nummer}p${i}`);
  const { einladungen } = await erwarten<{ einladungen: { link: string }[] }>(
    inhaber.anfrage,
    "/api/v1/einladungen/liste",
    { personen: namen.map((name) => ({ rolle: "mitarbeiter", name })) },
    201,
  );
  const personen = await Promise.all(
    einladungen.map(({ link }, i) => annehmen(angaben, inhaber.betriebId, link, namen[i] ?? "")),
  );
  return { betriebId: inhaber.betriebId, personen };
};

/** Runs `aufgaben` with at most `n` at a time, keeping their order in the result */
export const inGruppen = async <T>(
  aufgaben: readonly (() => Promise<T>)[],
  n: number,
): Promise<T[]> => {
  const ergebnisse: T[] = new Array(aufgaben.length);
  let naechste = 0;
  const arbeiter = async () => {
    while (naechste < aufgaben.length) {
      const index = naechste++;
      ergebnisse[index] = await (aufgaben[index] as () => Promise<T>)();
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, aufgaben.length) }, arbeiter));
  return ergebnisse;
};

/** Sets up all businesses and their people, without stamping */
export const aufbauen = async (angaben: LastAngaben) => {
  const betriebe = await inGruppen(
    Array.from({ length: angaben.betriebe }, (_, nummer) => () => betriebAufbauen(angaben, nummer)),
    angaben.gleichzeitig,
  );
  return {
    betriebIds: betriebe.map((b) => b.betriebId),
    personen: betriebe.flatMap((b) => b.personen),
  };
};

/** One stamp, timed from sending to the whole answer; a request that throws counts as status 0 */
const gestempelt = async (person: Person, uhr: () => number): Promise<Messung> => {
  const beginn = uhr();
  try {
    const antwort = await person.anfrage(STEMPELN, { art: "kommen" });
    await antwort.arrayBuffer();
    return { dauerMs: Math.ceil(uhr() - beginn), status: antwort.status };
  } catch {
    return { dauerMs: Math.ceil(uhr() - beginn), status: 0 };
  }
};

/** Every person stamps "kommen" at the same moment */
export const alleStempeln = (
  personen: readonly Person[],
  uhr: () => number = () => performance.now(),
) => Promise.all(personen.map((person) => gestempelt(person, uhr)));

/** Sets up and stamps */
export const lastLaufen = async (angaben: LastAngaben): Promise<Ergebnis> => {
  const aufgebaut = await aufbauen(angaben);
  return { ...aufgebaut, messungen: await alleStempeln(aufgebaut.personen) };
};
