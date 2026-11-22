/*
 * A single norm on gesetze-im-internet.de (§ 3 ArbZG), built after the structure firsttris/haben's
 * tests describe (scripts/jahreswerte/normen.test.ts): navigation, heading (div.jnheader), text
 * (div.jnhtml), footer (div#fusszeile). The site sends ISO-8859-1 with the charset only in the meta
 * element; `latin1` gives the bytes as they come over the wire. Kept as a string, not an .html file,
 * because the markup is the site's (anchors without href), not ours to lint.
 */
export const ARBZG_3 = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html lang="de">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1" />
<title>§ 3 ArbZG - Einzelnorm</title>
<link rel="stylesheet" href="/css/styles.css" type="text/css" />
</head>
<body>
<div id="container">
<div id="header"><a href="/index.html"><img src="/img/bmjv_logo.png" alt="Bundesministerium der Justiz" /></a></div>
<div id="level2">
<div id="blaettern_zurueck"><a href="__2.html">zurück</a></div>
<div id="blaettern_weiter"><a href="__4.html">weiter</a></div>
</div>
<div id="paddingLR12">
<div class="jnheader">
<a name="BJNR117100994BJNE000300000"></a><a href="index.html#BJNR117100994BJNE000300000">Nichtamtliches Inhaltsverzeichnis</a>
<h1>Arbeitszeitgesetz (ArbZG)<br /><span class="jnenbez">&#167; 3</span>&nbsp;<span class="jnentitel">Arbeitszeit der Arbeitnehmer</span></h1>
</div>
<div class="jnhtml"><div><div class="jurAbsatz">Die werktägliche Arbeitszeit der Arbeitnehmer darf acht Stunden nicht überschreiten. Sie kann auf bis zu zehn Stunden nur verlängert werden, wenn innerhalb von sechs Kalendermonaten oder innerhalb von 24 Wochen im Durchschnitt acht Stunden werktäglich nicht überschritten werden.</div></div></div>
</div>
<div id="fusszeile"><ul class="footerul"><li><a href="/impressum.html">Impressum</a></li><li><a href="/datenschutz.html">Datenschutz</a></li><li>Stand: 20.11.2026</li></ul></div>
</div>
</body>
</html>
`;

/** The bytes in ISO-8859-1; every character of the fixtures is below U+0100 */
export const latin1 = (text: string): Uint8Array<ArrayBuffer> => {
  const bytes = Uint8Array.from(text, (zeichen) => zeichen.charCodeAt(0));
  if ([...text].some((zeichen) => zeichen.charCodeAt(0) > 0xff))
    throw new Error("nicht in ISO-8859-1");
  return bytes;
};
