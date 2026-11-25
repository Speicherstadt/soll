import { falten, inhaltszeile, textWert, utcZeit, ZEILENENDE } from "./zeilen.ts";

/*
 * A calendar feed after RFC 5545 (iCalendar): a VCALENDAR with one VEVENT per published shift
 * (S-503). No METHOD: the feed is a calendar to subscribe to, not an iTIP message, so DTSTAMP is
 * the time the event was last revised in the store, as LAST-MODIFIED (3.8.7.2). All times in UTC
 * (3.3.5, form #2): no VTIMEZONE needed, and a night shift across a change of clocks keeps its real
 * length; the calendar app shows it in its own zone.
 */

/** One event of the feed */
export type IcsTermin = {
  /** stable for the life of the shift (3.8.4.7) */
  uid: string;
  beginn: number;
  ende: number;
  /** when the shift was created and last revised in Soll (3.8.7.1, 3.8.7.3) */
  erstellt: number;
  geaendert: number;
  /** revisions since it was created (3.8.7.4) */
  sequenz: number;
  titel: string;
  ort: string;
  beschreibung: string;
};

export type IcsKalender = {
  /** the product that made the feed (3.7.3) */
  produkt: string;
  /** the name a calendar app shows for the subscription (RFC 7986, 5.1) */
  name: string;
  termine: readonly IcsTermin[];
};

/** How often a calendar app should ask again (RFC 7986, 5.7): every hour */
const AKTUALISIEREN = "PT1H";

const termin = (t: IcsTermin): string[] => [
  "BEGIN:VEVENT",
  inhaltszeile("UID", textWert(t.uid)),
  inhaltszeile("DTSTAMP", utcZeit(t.geaendert)),
  inhaltszeile("CREATED", utcZeit(t.erstellt)),
  inhaltszeile("LAST-MODIFIED", utcZeit(t.geaendert)),
  inhaltszeile("SEQUENCE", String(t.sequenz)),
  inhaltszeile("DTSTART", utcZeit(t.beginn)),
  inhaltszeile("DTEND", utcZeit(t.ende)),
  inhaltszeile("SUMMARY", textWert(t.titel)),
  ...(t.ort ? [inhaltszeile("LOCATION", textWert(t.ort))] : []),
  ...(t.beschreibung ? [inhaltszeile("DESCRIPTION", textWert(t.beschreibung))] : []),
  "STATUS:CONFIRMED",
  "TRANSP:OPAQUE",
  "END:VEVENT",
];

/**
 * The feed as text: every content line folded and ended with CRLF (3.1), the events in the order of
 * their beginning, so the same plan always gives the same bytes
 */
export const icsKalender = (kalender: IcsKalender): string => {
  const termine = [...kalender.termine].sort(
    (a, b) => a.beginn - b.beginn || a.uid.localeCompare(b.uid),
  );
  const zeilen = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    inhaltszeile("PRODID", textWert(kalender.produkt)),
    "CALSCALE:GREGORIAN",
    inhaltszeile("NAME", textWert(kalender.name)),
    inhaltszeile("X-WR-CALNAME", textWert(kalender.name)),
    inhaltszeile("REFRESH-INTERVAL;VALUE=DURATION", AKTUALISIEREN),
    inhaltszeile("X-PUBLISHED-TTL", AKTUALISIEREN),
    ...termine.flatMap(termin),
    "END:VCALENDAR",
  ];
  return zeilen.map((zeile) => `${falten(zeile)}${ZEILENENDE}`).join("");
};
