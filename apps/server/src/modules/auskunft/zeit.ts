/** An instant for people to read in the Auskunft: ISO 8601 in UTC (Art. 12 Abs. 1 DSGVO) */
export const iso = (zeitpunkt: number | Date): string => new Date(zeitpunkt).toISOString();
