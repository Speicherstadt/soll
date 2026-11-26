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
  const umfeld = zustand.stempelungen.map((s) => ({ art: s.art, zeitpunkt: s.zeitpunkt }));
  const stand = tagesstand(umfeld, jetzt, tag);
  return {
    tag,
    jetzt,
    nutzerId: zustand.betrieb.nutzerId,
    sollMinuten: 468,
    gesperrt: false,
    luecken: [],
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
    summen: { sollMinuten: 9828, istMinuten: 9640, saldoMinuten: -188 },
    nichtHinterlegt: [],
    befunde: [],
    tage: [
      {
        tag: `${monat}-02`,
        beginn: Date.parse(`${monat}-02T07:05:00+01:00`),
        ende: Date.parse(`${monat}-02T15:18:00+01:00`),
        pauseMinuten: 32,
        dauerMinuten: 461,
        abwesenheiten: [],
      },
      {
        tag: `${monat}-03`,
        beginn: Date.parse(`${monat}-03T07:01:00+01:00`),
        ende: Date.parse(`${monat}-03T15:24:00+01:00`),
        pauseMinuten: 34,
        dauerMinuten: 469,
        abwesenheiten: [],
      },
    ],
    gegeneintraege: [],
    startsalden: [],
  },
});

const wocheDaten = (montag: string) => ({
  montag,
  standorte: [{ standortId: "st1", name: "Hamburg", bundesland: "DE-HH" }],
  personen: DEMO_PERSONEN.map((p) => ({ nutzerId: p.nutzerId, name: p.name, rolle: p.rolle })),
  schichten: [],
  veroeffentlichtAm: null,
  befunde: [],
  tauschregeln: { ohneFreigabe: false },
});

const getBereichAntwort = (pfad: string, query: URLSearchParams): unknown => {
  if (pfad === "/api/v1/dienstplan/woche") return wocheDaten(query.get("montag") ?? "2026-11-23");
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
      tag: query.get("datum") ?? heuteTag(),
      jetzt: Date.now(),
      aktiv: zustand.stoppuhr.aktiv,
      buchungen: zustand.stoppuhr.buchungen,
      projekte: DEMO_PROJEKTE,
      taetigkeiten: DEMO_TAETIGKEITEN,
      gestempeltMinuten: 220,
      gebuchtMinuten: 150,
    };
  if (pfad === "/api/v1/projektzeit/stundennachweise") return { nachweise: [] };
  if (pfad === "/api/v1/projektzeit/auslastung")
    return {
      monat: query.get("monat") ?? "2026-10",
      anwesendMinuten: 35044,
      abrechenbarMinuten: 17677,
      internMinuten: 2640,
      ohneBuchungMinuten: 14727,
      jePersonSeit: null,
    };
  if (pfad === "/api/v1/projektzeit/haben/zugang") return { verbunden: false, url: null };
  if (pfad === "/api/v1/betrieb/pruefung") return zustand.pruefung;
  if (pfad === "/api/v1/arbeitszeit/erinnerungen")
    return {
      wuensche: { ausstempeln: true, pause: true, monat: true, mail: true },
      geraetAktiv: false,
      regeln: { ausstempeln: "20:00", monat: 3 },
      inhaber: true,
    };
  if (pfad === "/api/v1/arbeitszeit/datev")
    return {
      beraternummer: "12345",
      mandantennummer: "67890",
      lohnarten: {},
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
      jahr: 2026,
      bescheinigungAbTag: zustand.bescheinigungAbTag,
      kinderkrank: { ok: true, wert: { anspruchJeKind: 15, jeKind: {} } },
      rechte: { genehmigen: true, einstellen: true },
      abwesenheiten: zustand.abwesenheiten,
    };
  if (pfad === "/api/v1/arbeitszeit/abwesenheiten/offen") return { antraege: [] };
  if (pfad === "/api/v1/arbeitszeit/abwesenheiten/team") return { eintraege: [] };
  if (pfad === "/api/v1/arbeitszeit/konten")
    return {
      nutzerId: query.get("nutzerId") ?? "jonas",
      urlaub: { ok: true, restHalbtage: 46, geplantHalbtage: 0, befunde: [] },
      ueberstunden: { ok: true, saldoMinuten: 215, luecken: [] },
      hinweise: [],
      rechte: { pflegen: true },
    };
  return getBereichAntwort(pfad, query);
};

const schreiben = (pfad: string, body: Record<string, unknown>): unknown => {
  if (pfad === "/api/v1/arbeitszeit/stempel") {
    const art = (body.art as Stempelart) ?? "kommen";
    zustand.stempelungen = [
      ...zustand.stempelungen,
      { id: `s-${Date.now()}`, art, zeitpunkt: Date.now(), quelle: "web" },
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
    zustand.stoppuhr.aktiv = {
      buchungId: `b-${Date.now()}`,
      projektId: String(body.projektId ?? ""),
      taetigkeitId: String(body.taetigkeitId ?? "t1"),
      beginn: Date.now(),
    };
    return { ok: true };
  }
  if (pfad === "/api/v1/projektzeit/stoppuhr/stopp" && zustand.stoppuhr.aktiv) {
    zustand.stoppuhr.buchungen = [
      {
        ...zustand.stoppuhr.aktiv,
        ende: Date.now(),
        notiz: null,
        abgerechnetAm: null,
      },
      ...zustand.stoppuhr.buchungen,
    ];
    zustand.stoppuhr.aktiv = null;
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
