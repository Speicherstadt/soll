import { type Stempelart, tagesstand } from "@soll/arbeitszeit";
import type { Antwort } from "../api.ts";
import {
  DEMO_KUNDEN,
  DEMO_MODELLE,
  DEMO_PERSONEN,
  DEMO_PROJEKTE,
  DEMO_TAETIGKEITEN,
  demoStartzustand,
  heuteTag,
} from "./demoDaten.ts";

const zustand = demoStartzustand();

const ok = <T>(daten: T, status = 200): Antwort<T> => ({ ok: true, status, daten });

const tagDaten = (tag: string) => {
  const jetzt = Date.now();
  const umfeld = zustand.stempelungen;
  const stand = tagesstand(umfeld, jetzt, tag);
  return {
    tag,
    jetzt,
    nutzerId: zustand.betrieb.nutzerId,
    name: "Jonas Weber",
    sollMinuten: 468,
    pausenabzug: false,
    luecken: [],
    aenderungen: [],
    umfeld,
    stempelungen: zustand.stempelungen,
    stand: stand.ok
      ? stand.wert
      : {
          status: "aus",
          gearbeitetMinuten: 0,
          pauseMinuten: 0,
          sollMinuten: 468,
          befunde: [],
          nichtHinterlegt: false,
        },
  };
};

const monatDaten = (monat: string) => ({
  monat,
  nutzerId: zustand.betrieb.nutzerId,
  name: "Jonas Weber",
  eigen: true,
  vorbei: false,
  abschliessbarAb: null,
  offeneTage: [],
  geaenderteTage: [],
  bestaetigung: null,
  abschluss: null,
  ausgesondert: null,
  inhalt: {
    monat,
    summen: {
      sollMinuten: 9828,
      gearbeitetMinuten: 9640,
      gutschriftMinuten: 0,
      istMinuten: 9640,
      saldoMinuten: -188,
    },
    nichtHinterlegt: [],
    befunde: [],
    tage: [
      {
        tag: `${monat}-02`,
        modellMinuten: 468,
        stempel: [
          ["kommen", Date.parse(`${monat}-02T07:05:00+01:00`)],
          ["pause_anfang", Date.parse(`${monat}-02T12:00:00+01:00`)],
          ["pause_ende", Date.parse(`${monat}-02T12:32:00+01:00`)],
          ["gehen", Date.parse(`${monat}-02T15:18:00+01:00`)],
        ],
      },
      {
        tag: `${monat}-03`,
        modellMinuten: 468,
        stempel: [
          ["kommen", Date.parse(`${monat}-03T07:01:00+01:00`)],
          ["pause_anfang", Date.parse(`${monat}-03T12:00:00+01:00`)],
          ["pause_ende", Date.parse(`${monat}-03T12:34:00+01:00`)],
          ["gehen", Date.parse(`${monat}-03T15:24:00+01:00`)],
        ],
      },
    ],
    gegeneintraege: [],
    startsalden: [],
  },
});

const wocheDaten = () => ({
  standortId: "st1",
  tage: [
    "2026-11-23",
    "2026-11-24",
    "2026-11-25",
    "2026-11-26",
    "2026-11-27",
    "2026-11-28",
    "2026-11-29",
  ],
  kw: { jahr: 2026, woche: 48 },
  personen: DEMO_PERSONEN.map((p) => ({ nutzerId: p.nutzerId, name: p.name })),
  schichten: [],
  deckung: [],
  befunde: [],
});

const getBereichAntwort = (pfad: string, query: URLSearchParams): unknown => {
  if (pfad === "/api/v1/dienstplan/woche") return wocheDaten();
  if (pfad === "/api/v1/dienstplan/vorlagen") return { vorlagen: [] };
  if (pfad === "/api/v1/dienstplan/bedarf") return { bedarfe: [] };
  if (pfad === "/api/v1/dienstplan/tausch")
    return { tausche: [], anbietbar: [], kollegen: [], ohneFreigabe: false };
  if (pfad === "/api/v1/projektzeit/kunden") return { kunden: DEMO_KUNDEN };
  if (pfad === "/api/v1/projektzeit/projekte") return { projekte: DEMO_PROJEKTE };
  if (pfad === "/api/v1/projektzeit/taetigkeiten") return { taetigkeiten: DEMO_TAETIGKEITEN };
  if (pfad === "/api/v1/projektzeit/saetze") return { saetze: [] };
  if (pfad === "/api/v1/projektzeit/saetze/personen") return { personen: [] };
  if (pfad === "/api/v1/projektzeit/stoppuhr")
    return {
      nutzerId: "jonas",
      tag: query.get("datum") ?? heuteTag(),
      jetzt: Date.now(),
      laufend: zustand.stoppuhr.laufend,
      buchungen: zustand.stoppuhr.buchungen,
      gestempeltMinuten: 220,
      gebuchtMinuten: 150,
      hinweis: null,
      zuletzt: [{ projektId: "p1", taetigkeitId: "t2" }],
    };
  if (pfad === "/api/v1/projektzeit/stundennachweise") return { nachweise: [] };
  if (pfad === "/api/v1/projektzeit/auslastung")
    return {
      monat: query.get("monat") ?? "2026-10",
      jePersonSeit: null,
      team: {
        art: "team",
        personen: 5,
        anwesendMinuten: 35044,
        abrechenbarMinuten: 17677,
        internMinuten: 2640,
        ohneBuchungMinuten: 14727,
      },
    };
  if (pfad === "/api/v1/projektzeit/haben/zugang") return { verbunden: false, url: null };
  if (pfad === "/api/v1/betrieb/pruefung") return zustand.pruefung;
  if (pfad === "/api/v1/arbeitszeit/erinnerungen")
    return {
      vapidSchluessel: "",
      wuensche: { ausstempeln: true, pause: true, monat: true, mail: true },
      regeln: { gehenMinuten: 1200, pauseVorlauf: 15, monatTag: 3 },
      mail: true,
      geraete: 0,
    };
  if (pfad === "/api/v1/arbeitszeit/datev")
    return {
      beraterNr: "12345",
      mandantenNr: "67890",
      lohnarten: {},
      postenarten: [],
      personen: DEMO_PERSONEN.map((p, i) => ({
        nutzerId: p.nutzerId,
        name: p.name,
        personalnummer: String(100 + i),
      })),
    };
  if (pfad === "/api/v1/terminal/geraete") return { geraete: [] };
  if (pfad === "/api/v1/terminal/personen") return { personen: [] };
  if (pfad === "/api/v1/terminal/karten") return { karten: [] };
  if (pfad === "/api/v1/zugaenge") return { zugaenge: [] };
  if (pfad === "/api/v1/standorte")
    return { standorte: [{ standortId: "st1", name: "Hamburg", bundesland: "DE-HH" }] };
  return {};
};

const getAntwort = (pfad: string, query: URLSearchParams): unknown => {
  if (pfad === "/api/v1/betrieb") return zustand.betrieb;
  if (pfad === "/api/v1/arbeitszeit/personen") return { personen: DEMO_PERSONEN };
  if (pfad === "/api/v1/arbeitszeit/modelle") return { modelle: DEMO_MODELLE };
  if (pfad === "/api/v1/arbeitszeit/tag") return tagDaten(query.get("datum") ?? heuteTag());
  if (pfad === "/api/v1/arbeitszeit/monat") return monatDaten(query.get("monat") ?? "2026-11");
  if (pfad === "/api/v1/arbeitszeit/abwesenheiten")
    return {
      nutzerId: "jonas",
      name: "Jonas Weber",
      jahr: 2026,
      heute: heuteTag(),
      bescheinigungAbTag: zustand.bescheinigungAbTag,
      urlaub: {
        jahr: 2026,
        anspruchHalbtage: 56,
        genommenHalbtage: 10,
        beantragtHalbtage: 0,
        restHalbtage: 46,
      },
      kinderkrank: { ok: true, wert: { anspruchJeKind: 15, jeKind: {} } },
      rechte: { freigeben: true, gesundheit: true, einstellen: true },
      abwesenheiten: zustand.abwesenheiten,
    };
  if (pfad === "/api/v1/arbeitszeit/abwesenheiten/offen") return { antraege: [], erinnerungen: [] };
  if (pfad === "/api/v1/arbeitszeit/abwesenheiten/team")
    return {
      von: "2026-11-25",
      bis: "2026-12-22",
      standortId: "st1",
      feiertage: [],
      abwesenheiten: [],
    };
  if (pfad === "/api/v1/arbeitszeit/konten")
    return {
      nutzerId: query.get("nutzerId") ?? "jonas",
      name: "Jonas Weber",
      heute: heuteTag(),
      urlaub: { ok: true, restHalbtage: 46, geplantHalbtage: 0, befunde: [] },
      ueberstunden: { ok: true, saldoMinuten: 215, luecken: [] },
      hinweise: [],
      anpassungen: [],
      rechte: { pflegen: true },
    };
  return getBereichAntwort(pfad, query);
};

const schreiben = (pfad: string, body: Record<string, unknown>): unknown => {
  if (pfad === "/api/v1/arbeitszeit/stempelungen" || pfad === "/api/v1/arbeitszeit/stempel") {
    const art = (body.art as Stempelart) ?? "kommen";
    zustand.stempelungen = [
      ...zustand.stempelungen,
      {
        stempelId: `s-${Date.now()}`,
        nutzerId: "jonas",
        art,
        zeitpunkt: Date.now(),
        geraetZeitpunkt: null,
        quelle: "app",
        offline: false,
        nummer: null,
        korrigiert: false,
      },
    ];
    return { ok: true };
  }
  if (pfad === "/api/v1/betrieb/module") {
    zustand.betrieb = {
      ...zustand.betrieb,
      module: { ...zustand.betrieb.module, ...(body as Partial<typeof zustand.betrieb.module>) },
    };
    return zustand.betrieb;
  }
  if (pfad === "/api/v1/betrieb/pruefung") {
    zustand.pruefung = { ...zustand.pruefung, ...(body as typeof zustand.pruefung) };
    return zustand.pruefung;
  }
  if (pfad === "/api/v1/projektzeit/stoppuhr/start") {
    zustand.stoppuhr.laufend = {
      buchungId: `b-${Date.now()}`,
      nutzerId: "jonas",
      projektId: body.projektId ? String(body.projektId) : null,
      taetigkeitId: String(body.taetigkeitId ?? "t1"),
      beginn: Date.now(),
      ende: null,
      tag: heuteTag(),
      notiz: "",
      abgerechnetAm: null,
      minuten: 0,
      kommen: null,
    };
    return { ok: true };
  }
  if (pfad === "/api/v1/projektzeit/stoppuhr/stopp" && zustand.stoppuhr.laufend) {
    const ende = Date.now();
    const minuten = Math.max(1, Math.round((ende - zustand.stoppuhr.laufend.beginn) / 60000));
    zustand.stoppuhr.buchungen = [
      { ...zustand.stoppuhr.laufend, ende, minuten },
      ...zustand.stoppuhr.buchungen,
    ];
    zustand.stoppuhr.laufend = null;
    return { ok: true };
  }
  return { ok: true };
};

export const demoAntwort = async <T>(
  roherPfad: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Antwort<T>> => {
  const [pfad, queryText = ""] = roherPfad.split("?");
  const query = new URLSearchParams(queryText);
  const methode = init.method ?? (init.body === undefined ? "GET" : "POST");
  if (methode === "GET") return ok(getAntwort(pfad ?? "", query) as T);
  const body = (init.body && typeof init.body === "object" ? init.body : {}) as Record<
    string,
    unknown
  >;
  return ok(schreiben(pfad ?? "", body) as T);
};
