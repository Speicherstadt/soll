# Verfahrensdokumentation Max Klempner

Stand: 2026-11-25 · Soll 1.0.0 · vollständig

Prüfwert der Audit-Kette beim Erzeugen: Nr. 37 · 3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a

## 1\. Allgemeine Beschreibung

Max Klempner nutzt Soll 1.0.0, eine selbst betriebene Software für Zeiterfassung und Dienstplanung, ohne das Modul Arbeitszeit. Die GoBD gelten für Aufzeichnungen, die Grundlage von Rechnungen sind, etwa abgerechnete Projektzeit.

Diese Verfahrensdokumentation beschreibt das Verfahren in Soll. Soll erzeugt sie bei jedem Abruf aus dem Stand des Betriebs und den Angaben, die nur der Betrieb machen kann; andere Programme und Abläufe des Betriebs gehören in die eigenen Abschnitte am Ende. Die Anleitung für Anwender steht unter https://soll.work/.

Bundesland des Betriebs: Hamburg.

Rechtsform: Einzelunternehmen

Anschrift: Wandsbeker Chaussee 1  
22089 Hamburg

Verantwortlich: Jonas Weber (Inhaber), vertreten durch Anna Weber (Büro)

Ort der Aufbewahrung: Server im Büro in Hamburg, Sicherungen auf einem NAS im selben Gebäude

- Modul Arbeitszeit (mit Abwesenheiten): ausgeschaltet
- Modul Dienstplan: ausgeschaltet
- Modul Projektzeit: eingeschaltet
- Modul Terminal: ausgeschaltet

## 2\. Anwenderdokumentation: Erfassung und Verarbeitung

Das Modul Arbeitszeit ist ausgeschaltet: Der Betrieb hat keine Beschäftigten, deren Arbeitszeit Soll aufzeichnet. Sobald eine beschäftigte Person Mitglied wird, schaltet Soll es wieder ein, weil die Pflicht zur Aufzeichnung dann gilt.

Projektzeit: Buchungen auf Kunden, Aufträge und Tätigkeiten stehen getrennt von der Arbeitszeit; sie bleiben änderbar, bis sie abgerechnet oder in einem unterschriebenen Stundennachweis sind, danach sind sie gesperrt.

## 3\. Anwenderdokumentation: Terminal

Das Modul Terminal ist ausgeschaltet; der Server lehnt jede Anfrage eines Tablets im Kiosk-Modus ab.

## 4\. Anwenderdokumentation: Weitergabe und Übernahme von Daten

Haben: Eine Übergabe der Projektzeit an eine Buchhaltung ist nicht eingerichtet.

Importe: Daten aus anderen Programmen übernimmt nur der Inhaber, nach Vorschau und einem Probelauf, der nichts schreibt. Die Originaldatei liegt unverändert unter ihrem SHA-256 im Datenverzeichnis; jeder Import ist eine nur angefügte Zeile mit Werkzeug, Datei, Zuordnung und Ergebnis, und jede übernommene Zeile trägt den Import und ihre Kennung im alten Programm und steht in der Audit-Kette. Was nicht übernommen wurde, bleibt im bisherigen Verfahren; es gehört in einen eigenen Abschnitt am Ende.

Solange das Modul Arbeitszeit ausgeschaltet ist, lehnt der Import Zeiten und Abwesenheiten ab.

Bisher hat der Betrieb nichts aus anderen Programmen übernommen.

Auskunft: Jede Person kann ihre Daten nach Art. 15 DSGVO abrufen; der Inhaber erteilt sie auch für Personen, die ausgeschieden sind.

## 5\. Technische Systemdokumentation: Audit-Kette und Prüfwert

Jede Schreiboperation in den Tabellen von Soll hängt in derselben Transaktion ein Glied an die Audit-Kette des Betriebs an; einen anderen Weg in diese Tabellen gibt es nicht. Die Module des Servers lesen über eine Verbindung, die SQLite nur lesend öffnet; die einzige schreibende Verbindung gehört der Funktion, die das Glied anhängt. Schlägt das Anhängen fehl, bleibt von der Schreiboperation nichts in der Datenbank (GoBD Rz. 107 bis 110).

Ein Glied enthält eine fortlaufende Nummer je Betrieb, den Zeitpunkt, den Akteur (die Person, auch wenn sie über einen API-Zugang schreibt, ein Gerät des Betriebs oder Soll selbst), Tabelle, Zeile und Art der Änderung, den SHA-256 des neuen Inhalts der Zeile, den Hash des Vorgängers und den SHA-256 über all das (Hash-Kette). Den alten Inhalt hält das vorige Glied derselben Zeile; so bleibt jede Änderung mit ihrem Stand davor erkennbar (Rz. 59 und 111).

Der Inhalt liegt getrennt vom Glied, das nur seinen Hash trägt.

Die Prüfung rechnet die Kette Glied für Glied nach, vergleicht den gespeicherten Kopf mit dem letzten Glied, jeden gespeicherten Inhalt mit seinem Hash und jede Zeile mit dem Inhalt ihres letzten Glieds. Sie meldet geänderte, entfernte oder eingeschobene Glieder, ein abgeschnittenes Ende und jede Zeile, die an der Kette vorbei eingefügt, geändert oder gelöscht wurde. Die Kette verhindert keine Änderung durch jemanden, der den Server betreibt und die Datenbank selbst ändern kann; sie macht sie sichtbar (Rz. 60).

Der Prüfwert ist Nummer und Hash eines Glieds („Nr. 1234 · \<SHA-256\>“).

Beim Erzeugen dieses Dokuments hatte die Kette 37 Glieder; Prüfwert Nr. 37 · 3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a3f9a. Außerhalb des Servers aufbewahrt zeigt er später, ob die Kette bis dahin verändert wurde.

Die Prüfung beim Erzeugen dieses Dokuments fand keine Befunde.

## 6\. Technische Systemdokumentation: Programm und Datenhaltung

Eingesetzt ist Soll 1.0.0. Soll ist ein Server (eine einzelne ausführbare Datei, auch als Container-Image) mit einer SQLite-Datenbank im WAL-Modus und einer App für Browser, Handy (PWA) und Tablet (Terminal). Was sich je Version geändert hat, nennen die Versionshinweise; die Version steht im Stand jeder Fassung dieses Dokuments.

Die Migrationen der Datenbank sind im Programm enthalten und laufen beim Start; eine schon angewendete Migration, die sich geändert hat oder fehlt, verhindert den Start. SQLite schreibt mit synchronous = FULL, so dass ein bestätigter Eintrag auch einen Stromausfall übersteht.

Zeitpunkte stehen als Millisekunden in UTC, Kalendertage als JJJJ-MM-TT in Europe/Berlin, Dauern in ganzen Minuten, Geldbeträge in Cent; nichts wird als Gleitkommazahl gerechnet.

Geheimnisse (Zugangsdaten zu anderen Diensten, Schlüssel von Karten, Abos für Web Push) liegen mit AES-256-GCM verschlüsselt in der Datenbank, mit dem Schlüssel aus SOLL\_SECRET\_KEY, ohne den der Server nicht startet. API-Tokens, PINs, QR-Codes und Kopplungscodes stehen nur als Hash darin. In diesem Dokument steht keins davon.

Mehrere Betriebe können eine Instanz teilen: Jede Tabelle von Soll trägt die Kennung des Betriebs, jede Abfrage filtert danach, und jeder Betrieb hat seine eigene Audit-Kette.

## 7\. Betriebsdokumentation: Zugänge und Rechte

Personen melden sich mit Passkey oder Passwort an. Wer den Betrieb nicht selbst angelegt hat, kommt nur über eine Einladung hinein; jede Einladung gilt für eine Rolle. Der Server prüft Rolle und Modul bei jeder Anfrage; ein abgeschaltetes Modul lehnt er ab, statt es nur auszublenden. Jede Änderung der Mitgliedschaft und der Rolle steht in der Audit-Kette (GoBD Rz. 100 und 103).

Gültige API-Zugänge für Programme gibt es nicht.

Die Rollen und was jede darf, mit der Zahl ihrer Mitglieder beim Erzeugen; ein Mitglied mit mehreren Rollen zählt bei jeder:

- Inhaber (1 Mitglied): den Betrieb und seine Module sehen; Kunden, Aufträge, Tätigkeiten und Stundensätze pflegen

## 8\. Betriebsdokumentation: Aufbewahrung und Aussonderung

Das Modul Arbeitszeit ist ausgeschaltet; Soll schließt keine Monate ab.

## 9\. Betriebsdokumentation: Betrieb und Datensicherung

Der Befehl soll backup schreibt eine in sich stimmige Kopie der Datenbank, auch während der Server schreibt (SQLite VACUUM INTO), prüft sie mit PRAGMA integrity\_check und überschreibt nie eine vorhandene Datei. Verschlüsseln, Auslagern und Wegräumen alter Sicherungen übernimmt das Backup des Rechners; Soll tut das nicht selbst.

soll restore legt eine Sicherung nur in ein leeres Datenverzeichnis, prüft danach die Audit-Kette jedes Betriebs und nennt das Ergebnis. Der Server startet nur mit demselben SOLL\_SECRET\_KEY wie zur Zeit der Sicherung; der Schlüssel gehört deshalb getrennt von den Sicherungen verwahrt.

Betrieb des Servers: Jonas Weber spielt Updates monatlich nach einer Sicherung ein.

Datensicherung: Täglich um 3:15 mit soll backup, danach restic auf das NAS; Anna prüft einmal im Quartal eine Wiederherstellung.

Ablage von Schlüsseln und Passwörtern: Tresor im Büro, Umschlag „Soll“

## 10\. Internes Kontrollsystem

Zugriff: Rechte hängen an der Rolle und werden bei jeder Anfrage auf dem Server geprüft, ebenso der Betrieb: Keine Anfrage liest oder schreibt Daten eines anderen Betriebs (GoBD Rz. 100 und 103).

Projektzeit: Abgerechnete Buchungen und Buchungen in einem unterschriebenen Stundennachweis sind gesperrt; der Nachweis trägt die Prüfsumme seines Inhalts.

Kontrolle der Kette: Die Prüfung der Audit-Kette läuft bei jedem Erzeugen dieses Dokuments und bei jeder Wiederherstellung einer Sicherung; beim Erzeugen dieses Dokuments ohne Befund.

Verantwortlich für das Verfahren: Jonas Weber (Inhaber), vertreten durch Anna Weber (Büro)

## 11\. Fassungen dieser Dokumentation

Jede Fassung trägt oben ihren Tag, die Version von Soll und den Prüfwert der Kette beim Erzeugen (Rz. 154). Die Angaben des Betriebs ändert nur der Inhaber; jede gespeicherte Änderung steht mit altem und neuem Inhalt in der Audit-Kette:

Die Angaben wurden noch nicht gespeichert.
