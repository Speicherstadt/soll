import nodemailer from "nodemailer";

/** A mail with an optional attachment, plain text (no HTML: nothing to render, nothing to track) */
export type Nachricht = {
  an: string;
  betreff: string;
  text: string;
  anhang?: { name: string; inhalt: Uint8Array; typ: string };
};

/** Sends a mail; errors come back as values (CLAUDE.md), the reason never with the address */
export type Mailer = (nachricht: Nachricht) => Promise<{ ok: true } | { ok: false }>;

/**
 * Mail over SMTP from the configuration (`SOLL_SMTP_URL`, e.g. smtps://user:pass@mail.example:465,
 * and `SOLL_MAIL_VON`). The password stays in the environment, never in the database.
 */
export const smtpMailer = (url: string, von: string): Mailer => {
  const transport = nodemailer.createTransport(url);
  return async (nachricht) => {
    try {
      await transport.sendMail({
        from: von,
        to: nachricht.an,
        subject: nachricht.betreff,
        text: nachricht.text,
        attachments: nachricht.anhang
          ? [
              {
                filename: nachricht.anhang.name,
                content: Buffer.from(nachricht.anhang.inhalt),
                contentType: nachricht.anhang.typ,
              },
            ]
          : [],
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  };
};

/** Whether an address can receive mail: one invited without e-mail has a placeholder (S-106) */
export const zustellbar = (adresse: string | null | undefined): adresse is string =>
  typeof adresse === "string" && adresse.includes("@") && !adresse.endsWith(".invalid");
