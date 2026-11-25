# FantastiX

Stammtisch-App als statische Website mit Admin- und Lesemodus sowie Supabase für Anmeldung, Daten und serverseitige Benachrichtigungen.


- Die Ranglisten enthalten eine eigene Kategorie **Jahres-Sieger** mit einem Pokalsymbol je Jahr. Die Jahressieger-Pokale erscheinen identisch im jeweiligen Mitgliedsprofil (Admin- und Leseransicht). Die historischen Sieger 2021–2025 sind vorbelegt; der Jahreswechsel-Versand ergänzt den Sieger des Vorjahres automatisch.
## Version 4.2.4

- Neue Rolle **Kassier**: Admins können sie in der Benutzerverwaltung vergeben. Kassierer können im Lesemodus Strafen erfassen und kassieren, den Kassenstand korrigieren und Ausgaben buchen. Die Berechtigungen werden serverseitig über Supabase-RPCs geprüft.
- Admin- und Kassiererrollen erscheinen in Mitgliederprofilen. Die Statusanzeige für aktive bzw. archivierte Mitglieder wurde aus den Profilen entfernt.
- Für die Datenbank einmalig `supabase/kassier-role.sql` im Supabase SQL Editor ausführen.

## Version 4.1.8

- Die Teilnehmerzeilen im Admin-Stammtisch verwenden jetzt dieselbe Anordnung und Darstellung wie die Event-Abstimmung.
- Abstimmungslisten für Events und Stammtische sind im Adminmodus einheitlich ausgerichtet.
- Admin-Stimmen bei Events blockieren Mitglieder nicht; Mitglieder können bis zur Abstimmfrist selbst abstimmen.
- Admin-Stimmen bei Events sind mit „Durch Admin“ gekennzeichnet.
- Das Event-Abstimmfristfeld ist kompakter dargestellt.
- Organisatoren erhalten bei Mitgliederstimmen zu Stammtischen und Events eine Glockennachricht.
- Auf der Startseite steht die Eventbezeichnung direkt unter dem Datum, einheitlich im Admin- und Lesemodus.
- Organisator-Bearbeitung verwendet für Stammtisch und Event denselben Dialogablauf; Events ergänzen Beginn, Ende und Abstimmfrist.
- Mitglieder können Admin-Korrekturen vor Fristablauf weiterhin selbst ändern. Admins können Stimmen in beiden Terminarten explizit auf „Offen“ zurücksetzen.
- Eine Terminänderung benachrichtigt weiterhin alle anderen Mitglieder; der auslösende Admin erhält keine eigene Event-Änderungs-Glocke.
- Eventänderungen durch Mitglieder lösen neben der Glockennachricht auch einen Push an die übrigen Mitglieder aus.
- Die Event-Abstimmfrist erscheint im selben Frist-Chip wie beim Stammtisch.

## Version 4.1.5

- Event-Organisatoren und Admins können eine eigene Abstimmfrist festlegen. Ohne eigene Frist ist die Abstimmung bis zum letzten Eventtag um 23:59 Uhr offen.
- Abstimmfristen werden auch serverseitig durchgesetzt. Die bestehende Erinnerungseinstellung benachrichtigt Mitglieder vor dem Event-Fristablauf.
- Organisator-Bearbeitung von Events bleibt auch dann verfügbar, wenn ein anderes Mitglied das Event erstellt hat.

## Version 4.1.4

- Status-Badge beim nächsten Event auf der Startseite entfernt, in Admin- und Lesemodus.

## Version 4.1.3

- Überschriften in Stammtisch- und Eventlisten sind größer und kräftiger, mit einem zum Farbschema passenden Hintergrund, Akzentkante und deutlicherem Anzahl-Badge. Einheitlich im Admin- und Lesemodus.

## Version 4.1.2

- Status-Badge beim nächsten Stammtisch auf der Startseite entfernt. Der Button „Event öffnen“ verwendet in Admin- und Lesemodus dieselbe Darstellung wie „Stammtisch öffnen“.

## Version 4.1.1

- Auf der Startseite steht der Organisator vor dem Abstimmungs-Countdown, im Admin- und Lesemodus.

## Version 4.1.0

- Abstimmungsdetails für Stammtische und Events verwenden dieselbe Datumszeile mit Kalender-Icon wie Dashboard und Terminlisten.
- Status-Badge und doppelte Datumszeile über der Uhrzeit entfallen. Mehrtägige und noch offene Termine bleiben erkennbar.

## Version 4.0.9

- Frische, bisher nicht als Tagesbild gezeigte Fotos aus den letzten sieben Tagen werden bei der täglichen Auswahl bevorzugt. Innerhalb dieser Gruppe wird zufällig gewählt; danach bleibt der bisherige Zufallspool verfügbar. Das Vortagesfoto wird bei mehreren Bildern weiterhin ausgeschlossen.
- Ein bereits festgelegtes Tagesbild bleibt für alle Mitglieder bis zum Tageswechsel in Europe/Vienna gleich. Uploads ersetzen kein gültiges Tagesbild.
- Stammtisch- und Eventlisten zeigen das vollständige Datum mit demselben Kalender-Icon und derselben Typografie wie „Nächster Stammtisch“. Der doppelte Status entfällt; Kategorien und Öffnen rechts unten bleiben in beiden Modi erhalten.
- Die Supabase-Migration `fantastix_prefer_fresh_daily_photos` ist in der serverseitigen Migrationshistorie dokumentiert.

## Version 4.0.8

- Gemeinsamer Profilkopf mit Bild, Name, Mitgliedsnummer, Status und letzter Aktivität in beiden Mitgliedsdetailansichten.
- Aktuelle Übersicht zu Stammtischserie und offenen Strafen sowie eine Historie mit Datumsblöcken und Orts-/Abstimmungs-Icons. Jahres- und Gesamtteilnahmen aus der Rangliste werden in dieser Ansicht nicht mehr angezeigt.
- Im Adminmodus ist das Bearbeitungsformular klar abgesetzt; das Entfernen eines Mitglieds ist eingeklappt. Nachladen der Historie erhält ungespeicherte Formulareingaben.

## Version 4.0.7

- Die Abstimmungsansichten für Stammtische und Events verwenden denselben Datumsblock und dieselben Metadaten-Icons wie die Terminlisten.
- Datum, Uhrzeit, Ort und Organisatoren sind in einem eigenen Infobereich angeordnet. Eventtitel stehen über die volle Breite; mehrtägige und noch offene Termine bleiben erkennbar.
- Hinweise stehen vor der Abstimmung, mit unveränderten Freigaberechten. Abstimmknöpfe und Speicherverhalten bleiben erhalten.

## Version 4.0.6

- Kompakter Listenkopf mit Tag/Monat links, Wochentag/Jahr daneben und Status rechts oben.
- Eventtitel stehen unter dem Kopf über die volle Breite; der Kopf bleibt auch auf dem Handy in einer Zeile. Die Öffnen-Aktion bleibt rechts unten.

## Version 4.0.4

- Stammtisch- und Eventlisten mit kompaktem Datumsblock, Metadaten-Icons und einer klaren Trennung von Rückmeldungen und Öffnen-Aktion.
- Anstehende Termine stehen chronologisch zuerst, vergangene Termine absteigend danach. Events ohne Datum bilden eine eigene Gruppe; laufende Events bleiben bei den anstehenden Terminen.
- Gleiche Listendarstellung im Lese- und Adminmodus, bestehende Detail- und Bearbeitungsfunktionen bleiben erreichbar.

## Version 4.0.3

- Das Datum bei „Nächster Event“ ist kleiner und leichter gewichtet, mit derselben Textfarbe wie bei „Nächster Stammtisch“.
- Unter den Abstimmknöpfen entfällt der reservierte Leerraum. Die Speichermeldung benötigt nur Platz, wenn sie tatsächlich angezeigt wird.

## Version 4.0.2

- Einheitliche SVG-Symbole für Daumen hoch, Daumen runter und Fragezeichen in Auswahlbuttons, Summen, Rückmeldungen, Historien und Admin-Korrekturen.
- Fünf neu abgestimmte Farbpaletten: Graphit/Türkis, Azur/Eis, Wald/Mint, Pflaume/Flieder und Kupfer/Hafer. Bestehende Gerätepräferenzen bleiben erhalten; das Standarddesign behält seine Farben.
- „Nächster Event“ verwendet dieselben Metadaten-Icons und dieselbe Kartenstruktur wie „Nächster Stammtisch“. Der bisherige Öffnen-Button bleibt bestehen.

## Version 4.0.1

- Gemeinsames Benachrichtigungsfenster im Lese- und Adminmodus mit einer Überschrift ohne zusätzliches Glockensymbol.
- Sofortiges Öffnen mit vorhandenem Datenstand, sanfte Übergänge, erhaltene Scrollposition und Tastaturfokus beim Aktualisieren. Escape und Klick auf den Hintergrund schließen das Fenster; reduzierte Bewegung wird berücksichtigt.
- Teilnahmeauswahl mit Daumen hoch, Fragezeichen und Daumen runter.

## Version 4.0.0

- Teilnahmeauswahl mit beschrifteten Icons, sanftem Druckfeedback und lokalem Speicherzustand für Stammtische und Events.
- „Nächster Stammtisch“ mit Kalender-, Uhrzeit-, Orts- und Organisator-Icons.
- Persönliche Begrüßung „Servus, [Name]“ auf der Startseite; ohne Mitgliedszuordnung „Servus“.
- Aktiver Menüpunkt im Standarddesign rot mit weißer Schrift und weißen Icons. Alternative Farbthemen bleiben erhalten.
- Fristen und der Pflichtgrund bei Stammtisch-Absagen gelten unverändert. Bei reduzierter Bewegung entfallen Animationen.

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

## Neue Strafen ab Version 3.24.1

Neue Strafen lösen zusätzlich zur vorhandenen Glockenmeldung einen Push **nur an die Geräte des betroffenen Mitglieds** aus. Titel: „Neue Strafe“. Text: „Du hast eine neue Strafe erhalten. Grund: [Grund]. Betrag: [Betrag] €.“ Grund und Betrag werden beim Abruf der Warteschlange aus dem aktuellen Datenstand übernommen. Ein Klick öffnet die Kassa.

Der Versand wartet auf die Leserfreigabe der Strafe. Andere Mitglieder und Admin-Konten ohne die betroffene Mitgliedszuordnung erhalten diesen Push nicht. Änderungen, Zahlungen und serverseitige Rücksicherungen lösen keine zusätzliche Meldung für dieselbe Strafen-ID aus. Gelöschte oder einem anderen Mitglied zugeordnete Strafen werden vor dem Versand ausgeschlossen. Die Supabase-Migration `fantastix_new_fine_member_push` verwendet den bestehenden Versandserver und ist in der Migrationshistorie dokumentiert.

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
