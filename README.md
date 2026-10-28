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

## Datenbank und Benachrichtigungen

Die vorhandenen SQL-Dateien bleiben als Einrichtungscode und Wartungsreferenz erhalten. Das Repository enthält nicht alle bereits produktiv ausgeführten Migrationen oder alle serverseitigen Push-Komponenten. Es ist daher kein vollständiges Paket zum Neuaufsetzen der Datenbank. Ältere SQL-Dateien nicht pauschal erneut ausführen: Sie können neuere Funktionen überschreiben.

- [Push-Fristerinnerungen](README_ERINNERUNGEN.md): technische Einrichtung und Versandverhalten.
- [Glockenmeldungen](README_GLOCKENMELDUNGEN.md): Ereignisse und Empfänger.
- [RLS-Prüfplan](05_RLS_TESTPLAN.txt): Zugriffsrechte mit getrennten Benutzerkonten prüfen.

Diese technischen Anleitungen beschreiben einzelne Einführungsschritte. Hinweise auf noch nicht veröffentlichte Änderungen beziehen sich auf den damaligen Arbeitsstand, nicht auf den aktuellen Betriebsstatus. Einige dort genannte SQL-Dateien und Serverdateien fehlen im Repository.

## Tests

Die Dateien `test-*.cjs` enthalten Prüfungen für Funktionen, Darstellung und Benachrichtigungen. Sie werden mit Node.js ausgeführt, je nach Test mit `jsdom`, `@electric-sql/pglite` oder `web-push`. Einige Servertests benötigen zusätzlich die im Repository fehlenden Migrationen bzw. Serverdateien.

Beispiel für die Prüfungen der aktuellen Kassa und des Designs bei installiertem `jsdom`:

```sh
node test-cash-transfer.cjs
node test-modern-design.cjs
```

Veraltete Versionsanleitungen und die ungenutzte historische Ein-Datei-App wurden entfernt. Frühere Stände bleiben über die Git-Historie verfügbar.
