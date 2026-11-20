import { simpleParser } from "mailparser";
import { SMTPServer } from "smtp-server";
import { afterEach } from "vitest";

export type Empfangen = {
  an: string[];
  betreff: string;
  text: string;
  anhaenge: { name: string; inhalt: Buffer }[];
};

/**
 * An SMTP test server on a free local port for one test (CLAUDE.md: what the outside world provides
 * is replaced in tests); it accepts every mail and keeps it
 */
export const smtpTestServer = async () => {
  const empfangen: Empfangen[] = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    logger: false,
    onData: (strom, sitzung, fertig) => {
      simpleParser(strom)
        .then((mail) => {
          empfangen.push({
            an: sitzung.envelope.rcptTo.map((ziel) => ziel.address),
            betreff: mail.subject ?? "",
            text: mail.text ?? "",
            anhaenge: mail.attachments.map((a) => ({ name: a.filename ?? "", inhalt: a.content })),
          });
          fertig();
        })
        .catch(fertig);
    },
  });
  await new Promise<void>((bereit) => server.listen(0, "127.0.0.1", bereit));
  const adresse = server.server.address();
  const port = typeof adresse === "object" && adresse ? adresse.port : 0;
  afterEach(() => new Promise<void>((zu) => server.close(() => zu())));
  return { url: `smtp://127.0.0.1:${port}`, empfangen };
};
