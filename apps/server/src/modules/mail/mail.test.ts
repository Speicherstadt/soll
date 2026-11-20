import { describe, expect, it } from "vitest";
import { smtpMailer, zustellbar } from "./index.ts";
import { smtpTestServer } from "./smtp-test.ts";

describe("mail over SMTP", () => {
  it("delivers text and attachment to an SMTP server", async () => {
    const smtp = await smtpTestServer();
    const senden = smtpMailer(smtp.url, "Soll <soll@betrieb.test>");
    const ergebnis = await senden({
      an: "lea@elbblick.test",
      betreff: "Dein Stundenzettel",
      text: "Prüfwert: Nr. 1 · abc",
      anhang: {
        name: "stundenzettel.pdf",
        inhalt: new Uint8Array([37, 80, 68, 70]),
        typ: "application/pdf",
      },
    });
    expect(ergebnis).toEqual({ ok: true });
    expect(smtp.empfangen).toHaveLength(1);
    expect(smtp.empfangen[0]?.an).toEqual(["lea@elbblick.test"]);
    expect(smtp.empfangen[0]?.betreff).toBe("Dein Stundenzettel");
    expect(smtp.empfangen[0]?.text.trim()).toBe("Prüfwert: Nr. 1 · abc");
    expect(smtp.empfangen[0]?.anhaenge[0]?.name).toBe("stundenzettel.pdf");
    expect(smtp.empfangen[0]?.anhaenge[0]?.inhalt.toString("latin1")).toBe("%PDF");
  });

  it("returns an error as a value when no server answers", async () => {
    const senden = smtpMailer("smtp://127.0.0.1:1", "soll@betrieb.test");
    expect(await senden({ an: "lea@elbblick.test", betreff: "x", text: "x" })).toEqual({
      ok: false,
    });
  });

  it("does not send to the placeholder of an invitation without e-mail", () => {
    expect(zustellbar("lea@elbblick.test")).toBe(true);
    expect(zustellbar("abc@einladung.soll.invalid")).toBe(false);
    expect(zustellbar(null)).toBe(false);
  });
});
