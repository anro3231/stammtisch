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
