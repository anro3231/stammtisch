# FantastiX 3.20.0 – echte Push-Erinnerungen

Die Fristerinnerung wird serverseitig minütlich geprüft und funktioniert auch bei geschlossener App. Eine Gerätebenachrichtigung benötigt die Zustimmung zu Push-Mitteilungen. Zusätzlich erscheint die Erinnerung unter der Glocke. Alle freigeschalteten aktiven Mitglieder erhalten die Erinnerung, unabhängig davon, ob sie bereits abgestimmt haben.

## Admin-Einstellung

Unter **Mehr → Abstimmungsfrist** können Administratoren die automatische Erinnerung ein-/ausschalten und **1–720 Stunden vor Ablauf der Frist** einstellen. Standard: eingeschaltet, 24 Stunden. Die bisherige Abstimmungsfrist bleibt separat einstellbar.

Beispiel: Stammtisch Freitag 19 Uhr, Abstimmungsfrist 24 Stunden vorher, Erinnerung weitere 24 Stunden vorher → Notification am Mittwoch gegen 19 Uhr. Maßgeblich ist Europe/Vienna; Stunden werden als echte Zeitabstände berechnet, auch bei Zeitumstellungen.

Der Dashboard-Text ist kürzer und rot, z. B. **„Noch 2 Tage 3 Std. abstimmen“**.

## Einmalige Einrichtung in Supabase

Der Browser allein kann keine verlässlichen Hintergrund-Erinnerungen auslösen. Diese neue Serverkomponente muss zusätzlich zu den Website-Dateien eingerichtet werden. Im aktuellen Arbeitsstand ist sie noch nicht im echten Projekt aktiviert.

1. Die vorhandenen Datenbankmigrationen einschließlich SQL 20 müssen eingerichtet sein. `24_ABSTIMMUNGSERINNERUNGEN.sql` im SQL Editor des bestehenden Supabase-Projekts ausführen. Dadurch werden eigene Erinnerungstabellen/RPCs, eine Versandwarteschlange und der Cron-Job `fantastix-vote-reminders` erstellt. Die bisherigen Push-Funktionen werden nicht ersetzt.
2. Die neue Edge Function aus `supabase/functions/fantastix-reminders/` bereitstellen:

   ```sh
   supabase functions deploy fantastix-reminders --no-verify-jwt
   ```

   Falls eine `supabase/config.toml` existiert, nur den Abschnitt `[functions.fantastix-reminders]` ergänzen. Bestehende Konfiguration nicht ersetzen. Diese Funktion authentifiziert Cron-Aufrufe über einen eigenen geheimen Header; sie ist nicht für Browseraufrufe gedacht.
3. In den **Edge Function Secrets** folgende Werte einrichten:

   | Secret | Wert |
   | --- | --- |
   | `FANTASTIX_REMINDER_VAPID_PUBLIC_KEY` | Derselbe öffentliche VAPID-Key wie in der bestehenden `push-config.js` |
   | `FANTASTIX_REMINDER_VAPID_PRIVATE_KEY` | Der dazugehörige bereits bestehende private VAPID-Key des bisherigen Push-Servers |
   | `FANTASTIX_REMINDER_VAPID_SUBJECT` | Eine gültige Kontaktadresse im Format `mailto:...` |
   | `FANTASTIX_REMINDER_DISPATCH_TOKEN` | Ein neuer zufälliger geheimer Wert mit mindestens 32 Zeichen |

   `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase seiner Edge-Laufzeit bereit. Alle privaten Schlüssel bleiben ausschließlich serverseitig. Keinen neuen VAPID-Schlüssel erzeugen: Die vorhandenen Geräteabos sind an das bisherige Schlüsselpaar gebunden.
4. Im **Supabase Vault** zwei Secrets anlegen:

   | Name | Wert |
   | --- | --- |
   | `fantastix_reminder_project_url` | Die URL des bestehenden Supabase-Projekts (`https://...supabase.co`) |
   | `fantastix_reminder_dispatch_token` | Exakt derselbe Wert wie `FANTASTIX_REMINDER_DISPATCH_TOKEN` |

   Bei bereits vorhandenen gleichnamigen Einträgen diese aktualisieren, nicht doppelt anlegen. SQL 24 verwendet diese Namen; keine geheimen Werte gehören in GitHub oder Website-Dateien.
5. Die aktualisierten Website-Dateien veröffentlichen. Die bestehende `cloud-config.js` und `push-config.js` beibehalten. Mitglieder öffnen die aktualisierte App einmal: Bereits erteilte Push-Freigaben werden automatisch für den neuen Erinnerungsversand registriert, ohne erneute Berechtigungsabfrage. Neue Mitglieder aktivieren Mitteilungen wie bisher.
6. Im Adminmodus Frist/Erinnerung speichern und die Cloud-Synchronisierung abwarten. Es werden nur bereits veröffentlichte Stammtische mit aktivierter Stammtisch-Leserfreigabe berücksichtigt.

## Verhalten und Zuverlässigkeit

- Pro Stammtisch-ID wird ein Erinnerungsvorgang angelegt. Wiederholte Cron-Aufrufe und Änderungen an den Einstellungen erzeugen keine zweite Erinnerung für denselben Stammtisch. Für mehrere Geräte wird je Abonnement zugestellt.
- Liegt der konfigurierte Erinnerungszeitpunkt beim Aktivieren bereits in der Vergangenheit, wird beim nächsten Lauf erinnert, sofern die Abstimmungsfrist noch offen ist. Nach Fristablauf wird nichts mehr versendet.
- Verschobene, noch nicht versendete Einträge prüfen beim Versand die aktuelle Frist und Vorlaufzeit erneut. Deaktivieren, Entfernen des Stammtischs, Entzug der Mitgliederzuordnung und Abschalten der Leserfreigabe verhindern weitere ausstehende Zustellungen.
- Vorübergehende Versandfehler werden mit Wartezeit wiederholt, maximal acht Versuche. Queue-Leases verhindern parallele Zustellungen derselben Nachricht. Eine bereits vom Push-Dienst akzeptierte Nachricht kann nach einem Absturz vor der Bestätigung erneut versucht werden; derselbe Notification-Tag ersetzt die ältere Geräteanzeige.
- Nicht mehr gültige Geräteabos (HTTP 404/410) werden entfernt. Die Geräteanzeige unterdrückt abgelaufene Erinnerungen zusätzlich; TTL verhindert lange verspätete Zustellungen. Push-Dienste und Geräteeinstellungen können die Zustellung dennoch verzögern.
- Die bestehende Push-Infrastruktur ist nicht vollständig im Repository enthalten. Die Verbindung mit dem produktiven System muss deshalb nach Einrichtung mit einem Testgerät geprüft werden. Insbesondere muss der vorhandene Push-Sender unbekannte `fantastix_updates.kind`-Werte ignorieren, damit er `vote_reminder` nicht zusätzlich verschickt.

## Prüfung nach Einrichtung

- Im Supabase-Cron-Bereich muss `fantastix-vote-reminders` aktiv sein und erfolgreich minütlich laufen.
- Ein freigeschaltetes Testmitglied öffnet die aktualisierte App mit aktivierten Mitteilungen. Für dessen Gerät muss ein Eintrag in `fantastix_reminder_subscriptions` vorhanden sein.
- Für einen Teststammtisch mit noch offener Frist und bereits erreichtem Erinnerungszeitpunkt muss nach dem nächsten Cron-Lauf die Notification auch bei geschlossener App erscheinen. Anschließende Läufe erzeugen keine zweite Erinnerung.
- Queue-Status ohne private Geräteendpunkte prüfen:

  ```sql
  select id, meeting_id, status, attempts, last_status, sent_at
  from public.fantastix_reminder_deliveries order by id desc limit 20;
  ```

## Lokale Tests ohne echte Nachrichten

```sh
npm install --no-save @electric-sql/pglite@0.3.14 web-push@3.6.7
node test-reminder-server.cjs
node test-reminder-dispatch.cjs
node test-reminder-client.cjs
node test-vote-countdown.cjs
node test-member-details.cjs
node test-admin-pages.cjs
node test-reader-compact.cjs
node test-reader-fines.cjs
node test-reader-calendar.cjs
node test-note-layout.cjs
```

Die SQL-Tests nutzen eine eingebettete PostgreSQL-Instanz mit synthetischen Daten und Platzhaltern für Supabase-Cron/HTTP. Die Dispatcher-Tests prüfen echte VAPID-Verschlüsselung ohne Netzwerkversand. Es wurde noch keine Notification an echte Mitglieder verschickt und keine produktive Datenbank geändert.

Technische Referenzen: [Supabase Cron](https://supabase.com/docs/guides/cron), [Edge Functions planen](https://supabase.com/docs/guides/functions/schedule-functions), [Web Push](https://github.com/web-push-libs/web-push).
