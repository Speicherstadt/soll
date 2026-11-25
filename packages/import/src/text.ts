/**
 * Lower case without accents and inner spaces, so "Lohnbüro", "lohnbuero" and "LOHN BÜRO" match: for
 * headers, roles, kinds and names written in different ways
 */
export const schluessel = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

/** A field with its spaces folded and trimmed */
export const bereinigt = (text: string): string => text.replace(/\s+/g, " ").trim();

/** Text without a byte order mark at its start (Excel writes one in UTF-8) */
export const ohneBom = (text: string): string => text.replace(/^﻿/, "");
