/* The values of Kimai's data, read without a guess: what is not one of them is null (S-705) */

const MINUTE = 60_000;

/**
 * An instant as Kimai's API writes it: ISO 8601 in the user's local time with its offset, the
 * format `Y-m-d\TH:i:sO` of JMS Serializer (kimai 2.73.0, config/packages/jms_serializer.yaml), so
 * "2026-09-01T07:00:00+0200"; an offset with a colon or "Z" is taken too. Without an offset the
 * instant is unknown and null; so is a day that does not exist, and any year outside 2000 to 2099.
 * Parsed by hand: `Date.parse` need not take "+0200" (ECMA-262 names only "+02:00").
 */
export const zeitpunktLesen = (wert: unknown): number | null => {
  if (typeof wert !== "string") return null;
  const teile =
    /^(20\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,6})?(Z|([+-])(\d\d):?(\d\d))$/.exec(
      wert.trim(),
    );
  if (!teile) return null;
  const [jahr, monat, tag, stunde, minute, sekunde] = teile.slice(1, 7).map(Number) as number[];
  const lokal = Date.UTC(
    jahr as number,
    (monat as number) - 1,
    tag,
    stunde,
    minute,
    sekunde as number,
  );
  const datum = new Date(lokal);
  if (
    datum.getUTCMonth() !== (monat as number) - 1 ||
    datum.getUTCDate() !== tag ||
    (stunde as number) > 23 ||
    (minute as number) > 59 ||
    (sekunde as number) > 59
  )
    return null;
  if (teile[7] === "Z") return lokal;
  const versatz = (Number(teile[9]) * 60 + Number(teile[10])) * MINUTE;
  if (Number(teile[10]) > 59 || versatz > 14 * 60 * MINUTE) return null;
  return teile[8] === "+" ? lokal - versatz : lokal + versatz;
};

/** A break in whole seconds as Kimai keeps it (`break`, Entity/Timesheet.php); missing is none */
export const sekundenLesen = (wert: unknown): number | null => {
  if (wert === null || wert === undefined) return 0;
  return typeof wert === "number" && Number.isSafeInteger(wert) && wert >= 0 ? wert : null;
};
