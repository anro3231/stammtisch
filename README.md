# FantastiX

Stammtisch-App als statische Website mit Admin- und Lesemodus sowie Supabase für Anmeldung, Daten und serverseitige Benachrichtigungen.

## Website

- `index.html` und `app.js`: Adminmodus.
- `lesen.html` und `lesen.js`: Lesemodus.
- `modern.css`, `ui-icons.js` und `calendar-view.js`: Darstellung und Kalender.
- `service-worker.js`, die Webmanifeste, das Logo und `icons/`: Installation, Offline-Cache und Push-Anzeige.
- `aktualisieren.html`: App-Cache aktualisieren.
- `version.js`: App-Version.

Die Dateien werden über GitHub Pages veröffentlicht; ein Build-Schritt ist nicht erforderlich. Die bestehende `cloud-config.js` und `push-config.js` bei Updates beibehalten. `cloud-config.example.js` dient als Konfigurationsvorlage. Private Server-Schlüssel und Service-Role-Schlüssel gehören nicht in diese Dateien.

## Bedienung ab Version 3.23.0

- Profilbilder lassen sich per Klick vergrößern; das Bildfenster lässt sich mit ×, Escape oder einem Klick neben das Bild schließen.
- Abstimmungen für Stammtische und Events haben drei Antworten: 👍 Dabei, ❓ Unsicher, 👎 Nicht dabei. Unsicher zählt weder als Anwesenheit noch als Absage. Abstimmungsfristen und geschützte Admin-Korrekturen bleiben wirksam.
- Geburtstage bearbeitet der Admin im Mitgliedsformular und speichert sie mit dem Mitglied. Zum Entfernen Tag und Monat leeren. Im Lesemodus ist die Bearbeitung ausgeblendet.
- Einzelne Strafen können nach Mitglied gefiltert werden; Summen und die Übersicht pro Mitglied bleiben davon unabhängig.
- Die Rangliste hat anklickbare Filter für alle Jahre und die einzelnen Jahresranglisten.
- Das Gasthausfeld schlägt bisherige Gasthäuser vor und erlaubt freie Eingabe. Gespeicherte Vorschläge werden mit den Admin-Daten synchronisiert.

Die Supabase-Migration `fantastix_unsure_votes` wurde für den dritten Abstimmungsstatus eingerichtet. Neue SQL-Dateien werden nicht im Repository abgelegt; die Migration ist in der Supabase-Migrationshistorie dokumentiert.

## Lesemodus ab Version 3.23.1

Menüs zeigen den bereits geladenen Stand sofort an. Bei Bedarf werden aktuelle Daten im Hintergrund geladen; kurz aufeinanderfolgende Menüwechsel teilen sich einen laufenden Abruf und verwenden einen weniger als 30 Sekunden alten Stand erneut. Profil, Veröffentlichung und Fristen sowie unabhängige Zusatzdaten werden parallel angefragt. Anwesenheit und Posteingang werden über einen gemeinsamen Hintergrundabruf aktualisiert; Push-Abonnements werden nicht bei jedem Menüwechsel erneut registriert.

Nach Abstimmungen oder Speichern wird weiterhin ein neuer Datenabruf erzwungen. Hintergrundaktualisierungen überschreiben keine ungespeicherten Eingaben. Bei vorübergehenden Netzwerkfehlern bleibt der bisherige Stand sichtbar; bei bestätigtem Entzug der Freigabe wird die Leseransicht geschlossen.

Prüfung mit simulierten langsamen Antworten: `node test-reader-speed.cjs` (benötigt `jsdom`).

## Notizen ab Version 3.23.2

Bei 👍 Dabei und ❓ Unsicher ist das optionale Notizfeld dauerhaft sichtbar (maximal 160 Zeichen, innerhalb der Abstimmungsfrist). Gespeicherte Notizen erscheinen auch beim Admin und im Abstimmungsstand. Die Supabase-Migration `fantastix_unsure_meeting_notes` ergänzt die Veröffentlichung von Unsicher-Notizen und bindet die Schreibrechte der Notizentabelle ausdrücklich an das eigene Mitglied.

## Abstimmungsübersichten ab Version 3.23.3

Die Summen für Stammtische und Events fassen „Unsicher“ und unbeantwortete Stimmen unter „Unsicher/noch offen“ zusammen. Einzelne Rückmeldungen und die Auswahl ❓ Unsicher bleiben unverändert. Die Einzelliste der Strafen zeigt zunächst 10 Einträge; „Mehr laden“ ergänzt jeweils 10 weitere. Ein Wechsel des Mitgliederfilters beginnt wieder mit 10 Einträgen.

## Kompakte Abstimmungsanzeige ab Version 3.23.7

Dashboard und Terminansichten zeigen 👍 Zusagen, 👎 Absagen und ❓ tatsächlich unsichere Stimmen ausschließlich als Emoji mit Anzahl. Unbeantwortete Stimmen werden in diesen Summen nicht mehr angezeigt. Einzelne Abstimmungsstatus verwenden ebenfalls nur die Emojis; verständliche Bezeichnungen für Screenreader bleiben erhalten. Die Strafenübersicht im Adminmodus zeigt wie der Lesemodus zuerst die offenen Beträge pro Mitglied und danach die einzelnen Strafen mit Filter und „Mehr laden“.

## Organisatoren und zusätzliche Pushs ab Version 3.24.0

- Neue Organisator-Zuweisungen für Stammtische und Events lösen einen gezielten Push ausschließlich an die Geräte des betroffenen Mitglieds aus. Es werden keine historischen Zuweisungen nachträglich angekündigt.
- Ändert sich das Gasthaus eines noch nicht vergangenen Stammtischs, erhalten berechtigte Mitglieder mit aktivierten Mitteilungen einen Push. Vor dem Versand inzwischen überholte Änderungen werden verworfen. Beim erstmaligen Anlegen kommt weiterhin die normale Terminankündigung.
- Der aktuelle Organisator kann im Lesemodus seinen Stammtisch öffnen und unter **Als Organisator: Uhrzeit & Gasthaus ändern** diese beiden Felder speichern. Die serverseitige Prüfung beschränkt Änderungen auf die eigene aktuelle Zuweisung, sichtbare und noch nicht vergangene Stammtische. Zwischenzeitliche Änderungen an Uhrzeit oder Ort werden als Konflikt gemeldet; andere Änderungen wie Stimmen bleiben erhalten. Eine reine Uhrzeitänderung erzeugt keinen zusätzlichen Gasthaus-Push.
- Geburtstage aktiver, für Leser sichtbarer Mitglieder werden ab **09:00 Uhr Europe/Vienna** einmal pro Person und Datum angekündigt. Der Zeitplan prüft alle 15 Minuten; normalerweise wird der Eintrag um 09:00 erzeugt und beim nächsten regulären Push-Lauf versendet. Sommer-/Winterzeit werden berücksichtigt. Eine Glockenmeldung erscheint ebenfalls; der Service Worker zeigt verspätete Geburtstags-Pushs nach Tagesende nicht mehr an.
- Der bestehende Versandserver verarbeitet diese Pushs weiterhin alle zwei Minuten. Empfang setzt ein freigeschaltetes aktives Konto bzw. Admin-Konto sowie ein registriertes Gerät mit Mitteilungsfreigabe voraus. Organisator-Pushs benötigen zusätzlich die passende Mitgliedszuordnung.

Die Supabase-Migration **fantastix_organizer_location_birthday_push** ergänzt die Auslöser, Empfängerprüfung, Geburtstagsterminplanung und das geschützte Organisator-RPC. Sie ist in der Supabase-Migrationshistorie dokumentiert; eine SQL-Datei wird nicht im Repository abgelegt. Der bestehende Push-Server und seine Geheimnisse werden weiterverwendet.

Zusätzliche Clientprüfungen: `node test-organizer-editor.cjs` (mit `jsdom`) und `node test-admin-push-worker.cjs`. Datenbanktests mit synthetischen Konten prüfen insbesondere Empfängertrennung, Änderungen durch fremde Konten, Konflikte, mehrfache Zeitplanläufe und abgelaufene Geburtstagsereignisse.

## Datenbank und Benachrichtigungen

Die SQL-Dateien wurden aus dem aktuellen Repository-Stand entfernt. Bereits in Supabase eingerichtete Tabellen und Funktionen bleiben davon unberührt; die Website benötigt diese Dateien nicht zur Laufzeit. Frühere SQL-Dateien sind über die Git-Historie abrufbar. Das Repository enthält damit kein vollständiges Paket zum Neuaufsetzen der Datenbank oder des serverseitigen Push-Versands. Ältere SQL-Dateien nicht pauschal erneut ausführen: Sie können neuere Funktionen überschreiben.

- [Push-Fristerinnerungen](README_ERINNERUNGEN.md): technische Einrichtung und Versandverhalten.
- [Glockenmeldungen](README_GLOCKENMELDUNGEN.md): Ereignisse und Empfänger.
- [RLS-Prüfplan](05_RLS_TESTPLAN.txt): Zugriffsrechte mit getrennten Benutzerkonten prüfen.

Diese technischen Anleitungen beschreiben einzelne Einführungsschritte. Hinweise auf noch nicht veröffentlichte Änderungen beziehen sich auf den damaligen Arbeitsstand, nicht auf den aktuellen Betriebsstatus. Einige dort genannte SQL-Dateien und Serverdateien fehlen im Repository.

## Tests

Die Dateien `test-*.cjs` enthalten Prüfungen für Funktionen, Darstellung und Benachrichtigungen. Sie werden mit Node.js ausgeführt, je nach Test mit `jsdom`, `@electric-sql/pglite` oder `web-push`. Datenbanktests, die SQL-Dateien laden, lassen sich nach deren Entfernung nicht unmittelbar ausführen. Dafür müssen die passenden Migrationen aus der Git-Historie bzw. dem ursprünglichen Update-Paket wiederhergestellt werden; einige benötigte Migrationen und Serverdateien waren bereits zuvor nicht im Repository enthalten.

Beispiel für die Prüfungen der aktuellen Kassa und des Designs bei installiertem `jsdom`:

```sh
node test-cash-transfer.cjs
node test-modern-design.cjs
node test-member-experience.cjs
```

Veraltete Versionsanleitungen und die ungenutzte historische Ein-Datei-App wurden entfernt. Frühere Stände bleiben über die Git-Historie verfügbar.
