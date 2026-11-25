import type { Monat } from "@soll/arbeitszeit";
import type { Aufgebaut, Mitglied } from "./aufbau.ts";
import { type Anfrage, erwarten } from "./client.ts";
import type { Ereignis, Handlung, PlanSchicht } from "./ereignis.ts";

/**
 * Plays the events of the demo through the HTTP API (BAULISTE.md S-909), with the app's clock set to
 * each event's instant first: Soll records the stamps, requests and closings at the time they happen
 * in the story, as it would have recorded them live.
 */
export type Pruefwert = { betrieb: string; person: string; monat: Monat; pruefwert: string };

type Lauf = {
  betriebe: Readonly<Record<Ereignis["betrieb"], Aufgebaut>>;
  /** the ids Soll gave to what the story names by a reference (a stamp, an absence) */
  refs: Map<string, string>;
  /** the PINs at the café's terminal by person */
  pins: ReadonlyMap<string, string>;
  pruefwerte: Pruefwert[];
};

const ARBEITSZEIT = "/api/v1/arbeitszeit";
const PZ = "/api/v1/projektzeit";

/** The two strokes of the customer's signature on the surface of 600 × 200, whole numbers only */
const UNTERSCHRIFT = [
  [
    [30, 140],
    [90, 60],
    [150, 150],
    [210, 70],
    [270, 130],
  ],
  [
    [320, 110],
    [470, 95],
    [560, 120],
  ],
];

const mitglied = (aufgebaut: Aufgebaut, schluessel: string): Mitglied => {
  const gefunden = aufgebaut.personen.get(schluessel);
  if (!gefunden) throw new Error(`unknown person ${schluessel}`);
  return gefunden;
};

const ref = (lauf: Lauf, name: string): string => {
  const id = lauf.refs.get(name);
  if (!id) throw new Error(`unknown reference ${name}`);
  return id;
};

/** A stamp: in the browser at Weber, at the counter's terminal with the PIN at the café */
const stempeln = async (
  lauf: Lauf,
  ereignis: Ereignis,
  h: Extract<Handlung, { art: "stempeln" }>,
) => {
  const aufgebaut = lauf.betriebe[ereignis.betrieb];
  const pin = lauf.pins.get(h.person);
  const stempel =
    aufgebaut.terminal && pin
      ? (
          await erwarten<{ stempel: { stempelId: string } }>(
            aufgebaut.terminal,
            "/api/v1/kiosk/stempeln",
            {
              body: { ausweis: { pin }, art: h.stempel },
            },
          )
        ).stempel
      : await erwarten<{ stempelId: string }>(
          mitglied(aufgebaut, h.person).anfrage,
          `${ARBEITSZEIT}/stempelungen`,
          {
            body: { art: h.stempel },
          },
        );
  if (h.ref) lauf.refs.set(h.ref, stempel.stempelId);
};

/** Plans each shift of a week at the site and publishes the week */
const planen = async (
  aufgebaut: Aufgebaut,
  von: Anfrage,
  woche: string,
  schichten: readonly PlanSchicht[],
) => {
  for (const { person, ...schicht } of schichten)
    await erwarten(von, "/api/v1/dienstplan/schichten", {
      body: {
        ...schicht,
        standortId: aufgebaut.standortId,
        nutzerId: mitglied(aufgebaut, person).nutzerId,
      },
    });
  await erwarten(von, "/api/v1/dienstplan/veroeffentlichen", {
    body: { standortId: aufgebaut.standortId, tag: woche },
  });
};

/** The customer signs the report the preview shows, as it stands */
const nachweisUnterschreiben = async (
  aufgebaut: Aufgebaut,
  von: Anfrage,
  h: Extract<Handlung, { art: "nachweis" }>,
) => {
  const auswahl = {
    projektId: aufgebaut.projekte.get(h.projekt) ?? "",
    von: h.vonTag,
    bis: h.bisTag,
  };
  const { stand } = await erwarten<{ stand: string }>(
    von,
    `${PZ}/stundennachweise/vorschau?${new URLSearchParams(auswahl).toString()}`,
    { method: "GET" },
  );
  await erwarten(von, `${PZ}/stundennachweise`, {
    body: { ...auswahl, stand, unterzeichner: h.unterzeichner, unterschrift: UNTERSCHRIFT },
  });
};

const abwesenheit = async (lauf: Lauf, aufgebaut: Aufgebaut, h: Handlung) => {
  const basis = `${ARBEITSZEIT}/abwesenheiten`;
  if (h.art === "antrag" || h.art === "krank") {
    const body =
      h.art === "antrag"
        ? { art: h.abwesenheit, von: h.von, bis: h.bis }
        : { art: h.abwesenheit, bis: h.bis, kind: h.kind };
    const { abwesenheitId } = await erwarten<{ abwesenheitId: string }>(
      mitglied(aufgebaut, h.person).anfrage,
      `${basis}/${h.art}`,
      { body },
    );
    lauf.refs.set(h.ref, abwesenheitId);
  } else if (h.art === "freigeben" || h.art === "bescheinigung") {
    const body = h.art === "freigeben" ? {} : { bescheinigung: "eau" };
    await erwarten(mitglied(aufgebaut, h.von).anfrage, `${basis}/${ref(lauf, h.ref)}/${h.art}`, {
      body,
    });
  }
};

const monat = async (lauf: Lauf, ereignis: Ereignis, h: Handlung) => {
  const aufgebaut = lauf.betriebe[ereignis.betrieb];
  if (h.art === "bestaetigen")
    await erwarten(mitglied(aufgebaut, h.person).anfrage, `${ARBEITSZEIT}/monat/bestaetigen`, {
      body: { monat: h.monat },
    });
  if (h.art !== "abschliessen") return;
  const { abschluss } = await erwarten<{ abschluss: { pruefwert: string } }>(
    mitglied(aufgebaut, h.von).anfrage,
    `${ARBEITSZEIT}/monat/abschliessen`,
    { body: { monat: h.monat, nutzerId: mitglied(aufgebaut, h.person).nutzerId } },
  );
  lauf.pruefwerte.push({
    betrieb: ereignis.betrieb,
    person: h.person,
    monat: h.monat,
    pruefwert: abschluss.pruefwert,
  });
};

const ausfuehren = async (lauf: Lauf, ereignis: Ereignis) => {
  const h = ereignis.handlung;
  const aufgebaut = lauf.betriebe[ereignis.betrieb];
  switch (h.art) {
    case "stempeln":
      return stempeln(lauf, ereignis, h);
    case "nachtrag":
      return erwarten(mitglied(aufgebaut, h.von).anfrage, `${ARBEITSZEIT}/stempelungen/nachtrag`, {
        body: {
          nutzerId: mitglied(aufgebaut, h.person).nutzerId,
          art: h.stempel,
          zeitpunkt: h.zeitpunkt,
          grund: h.grund,
        },
      });
    case "aendern":
      return erwarten(
        mitglied(aufgebaut, h.von).anfrage,
        `${ARBEITSZEIT}/stempelungen/${ref(lauf, h.ref)}`,
        {
          method: "PATCH",
          body: { art: h.stempel, zeitpunkt: h.zeitpunkt, grund: h.grund },
        },
      );
    case "planen":
      return planen(aufgebaut, mitglied(aufgebaut, h.von).anfrage, h.woche, h.schichten);
    case "buchen":
      return erwarten(mitglied(aufgebaut, h.person).anfrage, `${PZ}/buchungen`, {
        body: {
          projektId: h.projekt === null ? null : aufgebaut.projekte.get(h.projekt),
          taetigkeitId: aufgebaut.taetigkeiten.get(h.taetigkeit) ?? h.taetigkeit,
          beginn: h.beginn,
          ende: h.ende,
          ...(h.notiz ? { notiz: h.notiz } : {}),
        },
      });
    case "nachweis":
      return nachweisUnterschreiben(aufgebaut, mitglied(aufgebaut, h.von).anfrage, h);
    case "bestaetigen":
    case "abschliessen":
      return monat(lauf, ereignis, h);
    default:
      return abwesenheit(lauf, aufgebaut, h);
  }
};

/** Plays every event in order, the clock at its instant; the Prüfwerte of the closed months */
export const abspielen = async (
  betriebe: Lauf["betriebe"],
  pins: ReadonlyMap<string, string>,
  ereignisse: readonly Ereignis[],
  uhrStellen: (zeit: number) => void,
): Promise<Pruefwert[]> => {
  const lauf: Lauf = { betriebe, refs: new Map(), pins, pruefwerte: [] };
  for (const ereignis of ereignisse) {
    uhrStellen(ereignis.zeit);
    await ausfuehren(lauf, ereignis);
  }
  return lauf.pruefwerte;
};
