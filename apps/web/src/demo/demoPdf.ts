import type { MonatAnsicht } from "../monat/typen.ts";
import { saldoText, type Zeile, zeilenDesMonats } from "../monat/zeilen.ts";

const RAND = 44;
const BREITE = 595.28;
const HOEHE = 841.89;
const RECHTS = BREITE - RAND;
const INHALT = RECHTS - RAND;

const C = {
  ink: "0.04 0.04 0.05",
  muted: "0.44 0.44 0.48",
  subtle: "0.58 0.58 0.62",
  border: "0.86 0.86 0.89",
  borderStrong: "0.75 0.75 0.79",
  cardBg: "0.98 0.98 0.985",
  headBg: "0.95 0.95 0.96",
  zebraBg: "0.985 0.985 0.99",
  white: "1 1 1",
  green: "0.08 0.50 0.24",
  red: "0.73 0.11 0.11",
} as const;

const SPALTEN = {
  tag: RAND + 8,
  beginn: RAND + 128,
  ende: RAND + 184,
  pause: RAND + 240,
  ist: RAND + 298,
  soll: RAND + 356,
  saldo: RAND + 418,
  hinweis: RAND + 432,
} as const;

const dauer = (minuten: number): string => {
  const abs = Math.abs(Math.round(minuten));
  return `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
};

const uhr = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
});

const tagFmt = new Intl.DateTimeFormat("de-DE", {
  timeZone: "UTC",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

const monatFmt = new Intl.DateTimeFormat("de-DE", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

const kurzerTag = (tag: string): string => tagFmt.format(new Date(`${tag}T12:00:00Z`));
const monatLabel = (monat: string): string => monatFmt.format(new Date(`${monat}-01T12:00:00Z`));

const neueWoche = (vorher: string | undefined, aktuell: string): boolean => {
  if (!vorher) return false;
  return (
    (Date.parse(`${aktuell}T12:00:00Z`) - Date.parse(`${vorher}T12:00:00Z`)) / 86_400_000 > 1.5
  );
};

/** Encodes text to PDF WinAnsi octal escapes for clean umlauts and dashes */
const pdfText = (text: string): string => {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (ch === "\\" || ch === "(" || ch === ")") out += `\\${ch}`;
    else if (code === 0x2013 || code === 0x2014) out += "\\226";
    else if (code === 0x00b7) out += "\\267";
    else if (code >= 0x20 && code <= 0x7e) out += ch;
    else if (code >= 0xa0 && code <= 0xff) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += " ";
  }
  return out;
};

const textBreite = (text: string, groesse: number, fett = false): number => {
  let w = 0;
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") w += 0.556;
    else if (ch === ":" || ch === "." || ch === "," || ch === " " || ch === "i" || ch === "l")
      w += 0.278;
    else if (ch === "-") w += 0.333;
    else if (ch === "+") w += 0.584;
    else if (ch === "\u2013") w += 0.556;
    else if (ch >= "A" && ch <= "Z") w += 0.667;
    else w += 0.5;
  }
  return w * groesse * (fett ? 1.04 : 1);
};

const n = (v: number) => v.toFixed(2);

const rechteck = (
  x: number,
  y: number,
  w: number,
  h: number,
  fill?: string,
  stroke?: string,
  lineWidth = 0.6,
): string => {
  const teile: string[] = ["q"];
  if (fill) teile.push(`${fill} rg`);
  if (stroke) teile.push(`${stroke} RG ${n(lineWidth)} w`);
  teile.push(`${n(x)} ${n(y)} ${n(w)} ${n(h)} re`);
  teile.push(fill && stroke ? "B" : fill ? "f" : "S");
  teile.push("Q");
  return teile.join(" ");
};

const linie = (x1: number, y1: number, x2: number, y2: number, farbe: string, w = 0.6): string =>
  `q ${farbe} RG ${n(w)} w ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S Q`;

const zeile = (
  x: number,
  y: number,
  groesse: number,
  font: "F1" | "F2",
  farbe: string,
  text: string,
): string =>
  `q ${farbe} rg BT /${font} ${n(groesse)} Tf ${n(x)} ${n(y)} Td (${pdfText(text)}) Tj ET Q`;

const rechtsText = (
  xRechts: number,
  y: number,
  groesse: number,
  font: "F1" | "F2",
  farbe: string,
  text: string,
): string =>
  zeile(xRechts - textBreite(text, groesse, font === "F2"), y, groesse, font, farbe, text);

const saldoFarbe = (wert: number | null) =>
  wert === null ? C.muted : wert > 0 ? C.green : wert < 0 ? C.red : C.ink;

const kopfZeichnen = (b: string[], ansicht: MonatAnsicht) => {
  b.push(rechteck(RAND, HOEHE - 64, 20, 20, C.ink));
  b.push(zeile(RAND + 6.2, HOEHE - 58.2, 11.5, "F2", C.white, "S"));
  b.push(zeile(RAND + 28, HOEHE - 52, 10, "F2", C.ink, "Soll"));
  b.push(zeile(RAND + 28, HOEHE - 63, 8.5, "F1", C.muted, "Weber Haustechnik (Demo)"));
  const statusText = ansicht.abschluss ? "Abgeschlossen" : "Entwurf (Monat offen)";
  b.push(rechtsText(RECHTS, HOEHE - 52, 8.5, "F2", C.ink, statusText));
  b.push(rechtsText(RECHTS, HOEHE - 63, 8, "F1", C.muted, `Stand: ${ansicht.monat}`));
  b.push(linie(RAND, HOEHE - 74, RECHTS, HOEHE - 74, C.border, 0.7));
  b.push(zeile(RAND, HOEHE - 100, 17, "F2", C.ink, `Stundenzettel ${monatLabel(ansicht.monat)}`));
  b.push(zeile(RAND, HOEHE - 116, 9.5, "F1", C.muted, `${ansicht.name} \u00b7 Weber Haustechnik`));
};

const summenZeichnen = (b: string[], s: NonNullable<MonatAnsicht["inhalt"]["summen"]>): number => {
  const y = HOEHE - 176;
  const gap = 10;
  const kw = (INHALT - gap * 2) / 3;
  const karten = [
    { label: "SOLL", wert: dauer(s.sollMinuten), farbe: C.ink },
    { label: "IST", wert: dauer(s.istMinuten), farbe: C.ink },
    { label: "SALDO", wert: saldoText(s.saldoMinuten), farbe: saldoFarbe(s.saldoMinuten) },
  ];
  karten.forEach((k, i) => {
    const kx = RAND + i * (kw + gap);
    b.push(rechteck(kx, y, kw, 46, C.cardBg, C.border, 0.7));
    b.push(zeile(kx + 12, y + 31, 7.5, "F2", C.muted, k.label));
    b.push(zeile(kx + 12, y + 11, 15, "F2", k.farbe, k.wert));
  });
  return y - 20;
};

const tabelleZeichnen = (
  b: string[],
  startY: number,
  zeilen: Zeile[],
  s: MonatAnsicht["inhalt"]["summen"],
): number => {
  const headH = 22;
  const headY = startY - headH;
  b.push(rechteck(RAND, headY, INHALT, headH, C.headBg, C.border, 0.7));
  const ty = headY + 7.5;
  b.push(zeile(SPALTEN.tag, ty, 8.5, "F2", C.muted, "Tag"));
  b.push(rechtsText(SPALTEN.beginn, ty, 8.5, "F2", C.muted, "Beginn"));
  b.push(rechtsText(SPALTEN.ende, ty, 8.5, "F2", C.muted, "Ende"));
  b.push(rechtsText(SPALTEN.pause, ty, 8.5, "F2", C.muted, "Pause"));
  b.push(rechtsText(SPALTEN.ist, ty, 8.5, "F2", C.muted, "Ist"));
  b.push(rechtsText(SPALTEN.soll, ty, 8.5, "F2", C.muted, "Soll"));
  b.push(rechtsText(SPALTEN.saldo, ty, 8.5, "F2", C.muted, "Saldo"));
  b.push(zeile(SPALTEN.hinweis, ty, 8.5, "F2", C.muted, "Hinweis"));

  const rowH = 19;
  let ry = headY;
  const maxZeilen = Math.min(zeilen.length, 24);
  for (let i = 0; i < maxZeilen; i++) {
    const z = zeilen[i];
    if (!z) continue;
    const wochenStart = i > 0 && neueWoche(zeilen[i - 1]?.tag, z.tag);
    ry -= rowH;
    if (i % 2 === 1) b.push(rechteck(RAND, ry, INHALT, rowH, C.zebraBg));
    b.push(
      linie(
        RAND,
        ry + rowH,
        RECHTS,
        ry + rowH,
        wochenStart ? C.borderStrong : C.border,
        wochenStart ? 0.9 : 0.4,
      ),
    );
    const cy = ry + 6.5;
    const hatZeit = z.beginn !== null;
    const diff = hatZeit && z.sollMinuten !== null ? z.arbeitsMinuten - z.sollMinuten : null;
    b.push(zeile(SPALTEN.tag, cy, 8.5, "F2", C.ink, kurzerTag(z.tag)));
    b.push(
      rechtsText(
        SPALTEN.beginn,
        cy,
        8.5,
        "F1",
        C.muted,
        hatZeit && z.beginn !== null ? uhr.format(z.beginn) : "-",
      ),
    );
    b.push(
      rechtsText(
        SPALTEN.ende,
        cy,
        8.5,
        "F1",
        C.muted,
        hatZeit && z.ende !== null ? uhr.format(z.ende) : "-",
      ),
    );
    b.push(
      rechtsText(SPALTEN.pause, cy, 8.5, "F1", C.muted, hatZeit ? dauer(z.pauseMinuten) : "-"),
    );
    b.push(rechtsText(SPALTEN.ist, cy, 8.5, "F2", C.ink, hatZeit ? dauer(z.arbeitsMinuten) : "-"));
    b.push(
      rechtsText(
        SPALTEN.soll,
        cy,
        8.5,
        "F1",
        C.muted,
        z.sollMinuten === null ? "-" : dauer(z.sollMinuten),
      ),
    );
    b.push(
      rechtsText(
        SPALTEN.saldo,
        cy,
        8.5,
        "F2",
        diff === null ? C.muted : saldoFarbe(diff),
        diff === null ? "-" : saldoText(diff),
      ),
    );
    if (z.abwesenheiten.length > 0) {
      b.push(
        zeile(SPALTEN.hinweis, cy, 8, "F1", C.muted, z.abwesenheiten.map((a) => a.art).join(", ")),
      );
    }
  }
  if (s) {
    ry -= 22;
    b.push(rechteck(RAND, ry, INHALT, 22, C.headBg, C.border, 0.7));
    const fy = ry + 7.5;
    b.push(zeile(SPALTEN.tag, fy, 8.5, "F2", C.ink, `Gesamt (${zeilen.length} Tage)`));
    b.push(rechtsText(SPALTEN.ist, fy, 8.5, "F2", C.ink, dauer(s.istMinuten)));
    b.push(rechtsText(SPALTEN.soll, fy, 8.5, "F2", C.muted, dauer(s.sollMinuten)));
    b.push(
      rechtsText(
        SPALTEN.saldo,
        fy,
        8.5,
        "F2",
        saldoFarbe(s.saldoMinuten),
        saldoText(s.saldoMinuten),
      ),
    );
  }
  b.push(rechteck(RAND, ry, INHALT, headY + headH - ry, undefined, C.border, 0.7));
  return ry;
};

const fussZeichnen = (b: string[], ry: number) => {
  const sigY = Math.min(ry - 44, 108);
  const sigW = (INHALT - 32) / 2;
  b.push(linie(RAND, sigY, RAND + sigW, sigY, C.borderStrong, 0.7));
  b.push(zeile(RAND, sigY - 12, 8, "F1", C.muted, "Datum, Unterschrift Mitarbeitende"));
  b.push(linie(RECHTS - sigW, sigY, RECHTS, sigY, C.borderStrong, 0.7));
  b.push(zeile(RECHTS - sigW, sigY - 12, 8, "F1", C.muted, "Datum, Unterschrift Betrieb"));
  b.push(linie(RAND, 54, RECHTS, 54, C.border, 0.5));
  b.push(zeile(RAND, 40, 7.5, "F1", C.subtle, "Erstellt mit Soll \u00b7 soll.work"));
  b.push(rechtsText(RECHTS, 40, 7.5, "F1", C.subtle, "Seite 1 von 1"));
};

const pdfBauen = (stream: string): Blob => {
  const objekte = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> endobj",
    `6 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objekte) {
    offsets.push(out.length);
    out += `${obj}\n`;
  }
  const xrefPos = out.length;
  out += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer << /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return new Blob([out], { type: "application/pdf" });
};

/**
 * Generates a clean, print-ready A4 PDF-1.4 Stundenzettel in static demo mode (VITE_DEMO=1),
 * with branded header, KPI summary cards, full-width right-aligned table and signature footer.
 */
export const demoStundenzettelPdf = (ansicht: MonatAnsicht): Blob => {
  const zeilen = zeilenDesMonats(
    ansicht.inhalt.tage,
    ansicht.inhalt.befunde,
    ansicht.geaenderteTage,
    ansicht.abschluss?.am ?? Date.now(),
  ).filter((z) => z.beginn !== null || z.abwesenheiten.length > 0);
  const b: string[] = [];
  kopfZeichnen(b, ansicht);
  const nachSummen = ansicht.inhalt.summen ? summenZeichnen(b, ansicht.inhalt.summen) : HOEHE - 136;
  const ry = tabelleZeichnen(b, nachSummen, zeilen, ansicht.inhalt.summen);
  fussZeichnen(b, ry);
  return pdfBauen(b.join("\n"));
};
