export type ErsatzKontakt = {
    id: string;
    name: string;
    kundennummer: string | null;
    archived?: boolean;
    /** docs/api.md: "Der Kontakt muss ein Kunde und darf nicht archiviert sein, sonst 422" */
    isCustomer?: boolean;
    hourlyRateCents?: number | null;
};
export type ErsatzLeistung = {
    id: string;
    contactId: string;
    workedOn: string;
    minutes: number;
    description: string;
    hourlyRateCents: number | null;
    nonBillable: boolean;
    billableMinutes: number | null;
    project: string;
    source: string | null;
    externalId: string | null;
    invoiceId: string | null;
    invoiceNumber: string | null;
    invoiceStatus: "draft" | "final" | null;
};
/** A failure of the next call: an HTTP status of Haben, or no answer at all */
export type Stoerung = 400 | 401 | 403 | 422 | 429 | 500 | 503 | "netz";
/**
 * A Haben at `basis` (e.g. https://haben.test) with an API token and its rights; `fetch` answers
 * for it, `stoeren` lets the next calls fail (an HTTP status or no answer), `rechnen` puts an entry
 * on an invoice
 */
export declare const habenErsatz: (optionen?: {
    basis?: string;
    token?: string;
    rechte?: string[];
    kontakte?: ErsatzKontakt[];
}) => {
    basis: string;
    token: string;
    fetch: typeof globalThis.fetch;
    leistungen: () => ErsatzLeistung[];
    anfragen: () => {
        methode: string;
        pfad: string;
        koerper: unknown;
    }[];
    kontakte: ErsatzKontakt[];
    stoeren: (...stoerungen: Stoerung[]) => void;
    rechte: (rechte: string[]) => void;
    rechnen: (leistungId: string) => void;
};
export type HabenErsatz = ReturnType<typeof habenErsatz>;
