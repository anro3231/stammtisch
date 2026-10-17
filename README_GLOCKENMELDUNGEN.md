# FantastiX 3.21.0 – verständliche Glockenmeldungen

Neue Meldungen entstehen beim Speichern im zentralen Datenbestand, unabhängig von einer späteren Veröffentlichung des Leser-Snapshots.

| Ereignis | Glocke für |
| --- | --- |
| Zusage, Absage, geänderte oder zurückgezogene Stammtisch-Stimme | Admin und aktuelles Organisator-Mitglied |
| Zusage, Absage, geänderte oder zurückgezogene Event-Stimme | Admin und alle aktuellen Organisator-Mitglieder |
| Stammtisch-Organisator wird neu zugewiesen | Das neu zugewiesene Mitglied |
| Event-Organisator wird neu hinzugefügt | Jedes neu hinzugefügte Organisator-Mitglied |
| Neue Strafe | Ausschließlich das betroffene Mitglied |
| Strafe vollständig bezahlt | Das betroffene Mitglied (bestehende Funktion bleibt erhalten) |

Auch Mitglieder, die bereits abgestimmt haben, können als Organisatoren Glockenmeldungen empfangen. Freitext unter „andere Organisatoren“ hat keine zugeordnete Mitglieds-ID und kann daher keine persönliche Meldung bekommen.

## Beispiele

- „Clemens hat für deinen Stammtisch am 20.10.2026 in „Gasthaus“ zugesagt.“
- „Berta hat für dein Event „Hüttenausflug“ abgesagt.“
- „Du bist als Organisator für das Event „Hüttenausflug“ eingetragen.“
- „Du hast eine neue Strafe erhalten. Grund: Zu spät. Betrag: 5,00 €.“

Die Posteingänge zeigen verständliche Kategorien anstelle technischer Codes. Ältere knappe Meldungen werden soweit möglich als Sätze dargestellt. Ungelesen-Zähler und „Gelesen“-Funktion bleiben erhalten. Der Admin-Zähler lädt neue Abstimmungsmeldungen auch automatisch nach, ohne dass man erst die Glocke öffnen muss.

## Einspielen

1. Die Website-Dateien aus dem Update veröffentlichen.
2. In Supabase nach den bereits vorhandenen SQL-Dateien **20, 21 und 22** die Datei **25_GLOCKEN_ORGANISATOREN.sql** ausführen. Sie kann erneut ausgeführt werden. Nicht anschließend wieder SQL 20/21/22 ausführen: Diese würden die neueren Trigger überschreiben.
3. Es gibt keine nachträgliche Meldungsflut für alte Zuordnungen oder historische Strafen. Neue Meldungen entstehen bei künftigen Änderungen, nachdem die App mit der Cloud synchronisiert hat.
4. Die Leser-Regeln aus SQL 22 bleiben bestehen: Admin-Abstimmungen sind privat; Organizer-Meldungen tragen einen eigenen Typ und sind nur für das exakt adressierte Mitglied sichtbar.
5. Die konfigurierbaren Push-Fristerinnerungen aus Version 3.20.0 sind weiterhin enthalten; dafür zusätzlich die Einrichtung in **README_ERINNERUNGEN.md** durchführen. Die hier ergänzten Ereignisse sind Glockenmeldungen. Es wird kein zweiter Push-Versand für sie eingerichtet.

## Tests

`test-bell-notifications.cjs` prüft die SQL-Migration einschließlich wiederholter Ausführung, mehrere Organisatoren, unveränderte Notizen, rasche Stimmwechsel, Rücknahmen, Organisatorwechsel, private Strafen und Zahlungsbestätigungen. PostgreSQL-RLS wird mit unterschiedlichen Benutzeridentitäten geprüft; Render-Tests prüfen verständliche Texte und HTML-Escaping.

```sh
npm install --no-save @electric-sql/pglite@0.3.14
node test-bell-notifications.cjs
```

Die Prüfung verwendet ausschließlich synthetische Daten. Noch keine produktive Datenbankänderung und keine Meldung an echte Mitglieder.
