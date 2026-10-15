FantastiX v3.4.0 – GitHub Pages

NEU
- Zoom-Sperre für iPhone wie in v3.3.1 (systembedingte Ausnahmen möglich)
- Kontostand unter Kassa; mit Korrekturbuchung manuell änderbar
- Strafzahlungen erhöhen den Kontostand; Stornos ziehen die Zahlung wieder ab
- Ausgaben als Kassenbuch-Buchung erfassen und optional stornieren
- Monatlicher Mitgliederbeitrag (Standard 15,00 EUR je aktivem Mitglied)
- Beiträge am Monatsersten automatisch, sobald die App wieder geöffnet wird
- Konfigurierbarer Betrag und Startmonat, gebuchte Monate bleiben unverändert

WICHTIG ZUR MIGRATION
Bei der erstmaligen Aktualisierung wird ein Kassenbuch eingerichtet. Zuvor vorhandene
Strafzahlungen werden NICHT automatisch erneut als Kassen-Zugang gezählt, da du deinen
bestehenden Kontostand manuell festlegen kannst. Neue Strafzahlungen werden automatisch
zugerechnet. Standardstart für monatliche Beiträge ist der 1. des nächsten Monats,
damit ein bereits im Anfangskontostand enthaltener laufender Monat nicht doppelt zählt.
Du kannst den Startmonat in Kassa > Monatsbeiträge > Ändern anpassen.

Ein Monat wird pro Datenstand höchstens einmal gebucht. Öffnest du die App mehrere Monate
nicht, werden die ausstehenden Monate beim nächsten Öffnen nachgebucht. Dabei wird die
aktuell gespeicherte Anzahl aktiver Mitglieder für die Nachbuchungen verwendet; historische
Mitgliedswechsel lassen sich offline nicht rückwirkend rekonstruieren.
Die Monatsbuchungen sind automatische Soll-Kassen-Zugänge (keine bestätigten Bankumsätze).

UPDATE (Vollversion empfohlen)
1. Vorher unter Mehr > JSON exportieren ein vollständiges Backup anlegen.
2. Alle Dateien/Ordner aus dem ZIP nach GitHub hochladen, Dateien im Repo ersetzen.
3. Actions / Pages-Veröffentlichung abwarten; ggf. aktualisieren.html öffnen.
4. Unter Kassa den tatsächlichen Kontostand eintragen. Danach eine Testausgabe buchen.

BITTE NICHT die Browser-/Website-Daten löschen. Bestehende Mitglieder, Stammtische,
Strafen und Zahlungsdatensätze bleiben beim Update erhalten.
