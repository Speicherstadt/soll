import type { Tag } from "@soll/arbeitszeit";
import { type Betrieb, CAFE, DEMO_PASSWORT, geburtstagVonLeon, WEBER } from "./betriebe.ts";
import { type Anfrage, browser, erwarten, type Holen, tablet } from "./client.ts";

/**
 * Sets up the two businesses through the HTTP API, as Jonas and Mia would in the browser (BAULISTE.md
 * S-909): sign-up, business, setup wizard, site, models, invitation links, accepting them, models
 * assigned; at Weber the orders and Leon's birth date, at the café the terminal and the PINs.
 */
export type Mitglied = { nutzerId: string; anfrage: Anfrage; anmeldung: string };

export type Aufgebaut = {
  betriebId: string;
  standortId: string;
  personen: ReadonlyMap<string, Mitglied>;
  /** the orders and activities by the demo's keys */
  projekte: ReadonlyMap<string, string>;
  taetigkeiten: ReadonlyMap<string, string>;
  /** the café's tablet, or null */
  terminal: Anfrage | null;
};

type Umgebung = { holen: Holen; url: string; beginn: Tag };

const inhaberAnmelden = async ({ holen, url }: Umgebung, betrieb: Betrieb) => {
  const anfrage = browser(holen, url);
  const inhaber = betrieb.personen.find((p) => p.rolle === "inhaber");
  if (!inhaber) throw new Error(`${betrieb.name} has no owner`);
  await erwarten(anfrage, "/api/auth/sign-up/email", {
    body: { email: betrieb.email, password: DEMO_PASSWORT, name: inhaber.name },
  });
  const { id } = await erwarten<{ id: string }>(anfrage, "/api/auth/organization/create", {
    body: { name: betrieb.name, slug: betrieb.slug },
  });
  await erwarten(anfrage, "/api/auth/organization/set-active", { body: { organizationId: id } });
  const sitzung = await erwarten<{ user: { id: string } }>(anfrage, "/api/auth/get-session", {
    method: "GET",
  });
  const mitglied = { nutzerId: sitzung.user.id, anfrage, anmeldung: betrieb.email };
  return { betriebId: id, schluessel: inhaber.schluessel, mitglied };
};

/** The setup wizard, the rules' settings and the site */
const einrichten = async (inhaber: Anfrage, betrieb: Betrieb) => {
  await erwarten(inhaber, "/api/v1/einrichtung/betrieb", {
    method: "PUT",
    body: { name: betrieb.name, land: "HH", fragen: betrieb.fragen },
  });
  await erwarten(inhaber, "/api/v1/betrieb/pruefung", {
    method: "PUT",
    body: { ...betrieb.pruefung, ausgleichszeitraum: null, ausgleichBeginn: null },
  });
  const { standortId } = await erwarten<{ standortId: string }>(inhaber, "/api/v1/standorte", {
    body: { ...betrieb.standort, land: "HH" },
  });
  return standortId;
};

/** Invites everyone but the owner with one list of links; each accepts and signs in */
const einladen = async (
  umgebung: Umgebung,
  inhaber: Anfrage,
  betrieb: Betrieb,
  betriebId: string,
) => {
  const eingeladene = betrieb.personen.filter((p) => p.rolle !== "inhaber");
  const { einladungen } = await erwarten<{ einladungen: { link: string }[] }>(
    inhaber,
    "/api/v1/einladungen/liste",
    { body: { personen: eingeladene.map((p) => ({ rolle: p.rolle, name: p.name })) } },
  );
  const mitglieder: [string, Mitglied][] = [];
  for (const [i, person] of eingeladene.entries()) {
    const anfrage = browser(umgebung.holen, umgebung.url);
    const token = einladungen[i]?.link.split("/einladung/")[1] ?? "";
    const { nutzerId } = await erwarten<{ nutzerId: string }>(
      anfrage,
      `/api/v1/einladung/${token}/annehmen`,
      {
        body: { benutzername: person.schluessel, passwort: DEMO_PASSWORT },
      },
    );
    await erwarten(anfrage, "/api/auth/sign-in/username", {
      body: { username: person.schluessel, password: DEMO_PASSWORT },
    });
    await erwarten(anfrage, "/api/auth/organization/set-active", {
      body: { organizationId: betriebId },
    });
    mitglieder.push([person.schluessel, { nutzerId, anfrage, anmeldung: person.schluessel }]);
  }
  return mitglieder;
};

/** The models from the first day of data, each person on theirs */
const modelleZuordnen = async (
  umgebung: Umgebung,
  inhaber: Anfrage,
  betrieb: Betrieb,
  personen: ReadonlyMap<string, Mitglied>,
) => {
  const ids = new Map<string, string>();
  for (const [schluessel, modell] of Object.entries(betrieb.modelle)) {
    const { modellId } = await erwarten<{ modellId: string }>(
      inhaber,
      "/api/v1/arbeitszeit/modelle",
      {
        body: { ...modell, sollMinuten: [...modell.sollMinuten], gueltigAb: umgebung.beginn },
      },
    );
    ids.set(schluessel, modellId);
  }
  for (const person of betrieb.personen) {
    const nutzerId = personen.get(person.schluessel)?.nutzerId;
    if (person.modell === null || !nutzerId) continue;
    await erwarten(inhaber, `/api/v1/arbeitszeit/personen/${nutzerId}/modell`, {
      method: "PUT",
      body: { modellId: ids.get(person.modell), gueltigAb: umgebung.beginn },
    });
  }
};

/** Weber's customers, orders and own activities (the four fixed ones exist in every business) */
const auftraegeAnlegen = async (inhaber: Anfrage) => {
  const pz = "/api/v1/projektzeit";
  const kunden = [
    {
      schluessel: "elbhof",
      kunde: "Elbhof Wohnungsbau",
      nummer: "K-1001",
      projekt: "Bäder Elbhof, 3. OG",
      budget: 24_000,
    },
    {
      schluessel: "petersen",
      kunde: "Familie Petersen",
      nummer: "K-1002",
      projekt: "Heizungstausch Petersen",
      budget: 6_000,
    },
    {
      schluessel: "speicherblick",
      kunde: "Hotel Speicherblick",
      nummer: "K-1003",
      projekt: "Wartung Speicherblick",
      budget: null,
    },
  ];
  const projekte = new Map<string, string>();
  for (const k of kunden) {
    const { kundeId } = await erwarten<{ kundeId: string }>(inhaber, `${pz}/kunden`, {
      body: { name: k.kunde, nummer: k.nummer },
    });
    const { projektId } = await erwarten<{ projektId: string }>(inhaber, `${pz}/projekte`, {
      body: { kundeId, name: k.projekt, ...(k.budget ? { budgetMinuten: k.budget } : {}) },
    });
    projekte.set(k.schluessel, projektId);
  }
  const taetigkeiten = new Map<string, string>([["fahrt", "fahrt"]]);
  for (const [schluessel, name] of [
    ["montage", "Montage"],
    ["wartung", "Wartung"],
  ] as const) {
    const { taetigkeitId } = await erwarten<{ taetigkeitId: string }>(
      inhaber,
      `${pz}/taetigkeiten`,
      {
        body: { name },
      },
    );
    taetigkeiten.set(schluessel, taetigkeitId);
  }
  return { projekte, taetigkeiten };
};

/** The tablet by the café's counter, paired with a code of Mia's, and everyone's PIN */
const terminalKoppeln = async (
  umgebung: Umgebung,
  inhaber: Anfrage,
  personen: ReadonlyMap<string, Mitglied>,
) => {
  const { code } = await erwarten<{ code: string }>(inhaber, "/api/v1/terminal/geraete", {
    body: { name: "Tresen" },
  });
  const { token } = await erwarten<{ token: string }>(
    browser(umgebung.holen, umgebung.url),
    "/api/v1/kiosk/koppeln",
    {
      body: { code },
    },
  );
  for (const person of CAFE.personen) {
    const nutzerId = personen.get(person.schluessel)?.nutzerId;
    if (!person.pin || !nutzerId) continue;
    await erwarten(inhaber, `/api/v1/terminal/pins/${nutzerId}`, {
      method: "PUT",
      body: { pin: person.pin },
    });
  }
  return tablet(umgebung.holen, umgebung.url, token);
};

export const betriebAufbauen = async (
  umgebung: Umgebung,
  betrieb: Betrieb,
  heute: Tag,
): Promise<Aufgebaut> => {
  const { betriebId, schluessel, mitglied } = await inhaberAnmelden(umgebung, betrieb);
  const inhaber = mitglied.anfrage;
  const standortId = await einrichten(inhaber, betrieb);
  const personen = new Map([
    [schluessel, mitglied],
    ...(await einladen(umgebung, inhaber, betrieb, betriebId)),
  ]);
  await modelleZuordnen(umgebung, inhaber, betrieb, personen);
  const weber = betrieb === WEBER;
  if (weber)
    await erwarten(inhaber, `/api/v1/personen/${personen.get("leon")?.nutzerId}/angaben`, {
      method: "PUT",
      body: {
        geburtsdatum: geburtstagVonLeon(heute),
        wechselschicht: false,
        abruf: false,
        mutterschutz: [],
      },
    });
  const auftraege = weber
    ? await auftraegeAnlegen(inhaber)
    : { projekte: new Map(), taetigkeiten: new Map() };
  const terminal = weber ? null : await terminalKoppeln(umgebung, inhaber, personen);
  await erwarten(inhaber, "/api/v1/einrichtung/abschliessen", { body: {} });
  return { betriebId, standortId, personen, ...auftraege, terminal };
};
