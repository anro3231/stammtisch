FantastiX v3.12.1 – GitHub Pages + Supabase

Änderungen:
- In der Rangliste (Admin und Mitgliederportal) ein klarer Jahresfilter: Ewig und 2026, 2027 usw. automatisch ab Jahresbeginn.
- Im Admin-Mitgliederbildschirm die Schaltfläche „Teilnahmen 2026“ entfernt. Die bisherigen Startwerte bleiben in den Daten erhalten. Die Mitgliederübersicht zeigt automatisch das aktuelle Jahr.
- Auf dem Admin-Dashboard die Buttons „Kalender öffnen“ und „+ Mitglied“ entfernt. Kalender und Mitgliederverwaltung bleiben in der Navigation erreichbar.
- Push-Fix: Service Worker muss vor subscribe() aktiviert sein. Optionaler Offline-Cache kann seine Installation nicht mehr durch eine fehlende Datei verhindern.

Nur Dateien aus diesem ZIP ins bestehende GitHub-Repository kopieren.
Die vorhandene cloud-config.js beibehalten. Kein zusätzliches Supabase-SQL notwendig.
Falls Push weiterhin nicht funktioniert: Anleitung PUSH_UND_UPDATE.txt beachten.
