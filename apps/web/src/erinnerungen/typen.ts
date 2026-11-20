/** What GET /api/v1/arbeitszeit/erinnerungen answers (S-307) */
export type Wuensche = { ausstempeln: boolean; pause: boolean; monat: boolean; mail: boolean };
export type Regeln = { gehenMinuten: number; pauseVorlauf: number; monatTag: number };
export type ErinnerungAnsicht = {
  vapidSchluessel: string;
  wuensche: Wuensche;
  regeln: Regeln;
  /** whether mail can reach the person: SMTP set up and an address that receives mail */
  mail: boolean;
  geraete: number;
};
