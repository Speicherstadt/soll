import type { MonatAnsicht } from "../monat/typen.ts";
import { saldoText, zeilenDesMonats } from "../monat/zeilen.ts";

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

const pdfText = (text: string): string =>
  text
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/–|—/g, "-")
    .replace(/·/g, "|")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const zeile = (x: number, y: number, groesse: number, font: "F1" | "F2", text: string): string =>
  `BT /${font} ${groesse} Tf ${x} ${y} Td (${pdfText(text)}) Tj ET`;

/**
 * Generates a real, readable, minimal PDF-1.4 Stundenzettel in static demo mode (VITE_DEMO=1),
 * avoiding GitHub Pages' 404 HTML fallback on /api/v1/arbeitszeit/monat/stundenzettel.
 */
export const demoStundenzettelPdf = (ansicht: MonatAnsicht): Blob => {
  const zeilen = zeilenDesMonats(
    ansicht.inhalt.tage,
    ansicht.inhalt.befunde,
    ansicht.geaenderteTage,
    ansicht.abschluss?.am ?? Date.now(),
  ).filter((z) => z.beginn !== null || z.abwesenheiten.length > 0);

  const befehle: string[] = [];
  befehle.push(zeile(48, 790, 16, "F1", `Stundenzettel ${monatLabel(ansicht.monat)}`));
  befehle.push(zeile(48, 770, 10, "F1", `${ansicht.name} | Weber Haustechnik (Demo)`));

  const s = ansicht.inhalt.summen;
  if (s) {
    befehle.push(
      zeile(
        48,
        742,
        10,
        "F2",
        `Soll: ${dauer(s.sollMinuten)}   Ist: ${dauer(s.istMinuten)}   Saldo: ${saldoText(s.saldoMinuten)}`,
      ),
    );
  }

  befehle.push("0.85 w 48 728 m 547 728 l S");
  befehle.push(
    zeile(
      48,
      712,
      9,
      "F2",
      `${"Tag".padEnd(12)} ${"Beginn".padEnd(8)} ${"Ende".padEnd(8)} ${"Pause".padEnd(7)} ${"Ist".padEnd(7)} ${"Soll".padEnd(7)} Saldo`,
    ),
  );
  befehle.push("0.5 w 48 706 m 547 706 l S");

  let y = 690;
  for (const z of zeilen.slice(0, 32)) {
    const hatZeit = z.beginn !== null;
    const diff = hatZeit && z.sollMinuten !== null ? z.arbeitsMinuten - z.sollMinuten : null;
    const text = [
      kurzerTag(z.tag).padEnd(12),
      (z.beginn === null ? "-" : uhr.format(z.beginn)).padEnd(8),
      (z.ende === null ? "-" : uhr.format(z.ende)).padEnd(8),
      (hatZeit ? dauer(z.pauseMinuten) : "-").padEnd(7),
      (hatZeit ? dauer(z.arbeitsMinuten) : "-").padEnd(7),
      (z.sollMinuten === null ? "-" : dauer(z.sollMinuten)).padEnd(7),
      diff === null ? "-" : saldoText(diff),
    ].join(" ");
    befehle.push(zeile(48, y, 9, "F2", text));
    y -= 16;
  }

  const stream = befehle.join("\n");
  const objekte = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj",
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
