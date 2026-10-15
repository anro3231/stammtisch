STAMMTISCH+ | INSTALLATION OHNE MAC
================================

Diese Web-App läuft auf dem iPhone in Safari und lässt sich als Symbol zum Home-Bildschirm hinzufügen.
Keine Xcode-Installation, kein Mac, kein App Store notwendig.

WICHTIG: Das ZIP ist der Quellcode, keine fertig veröffentlichte Website.
Bevor du die App über einen Link verwenden kannst, muss sie auf einem HTTPS-Webhost veröffentlicht werden.
Ich kann die Website nicht ohne deinen Webhosting-Zugang veröffentlichen.

ANLEITUNG: OHNE MAC, NUR MIT iPHONE
---------------------------------
1. Erstelle auf https://github.com ein Konto (falls noch keines vorhanden).
2. Erstelle ein neues ÖFFENTLICHES Repository, z. B. "stammtisch-plus".
3. Lade die Dateien dieser ZIP hoch. Der Inhalt des Ordners muss im Hauptverzeichnis des
   Repositorys liegen: index.html, app.js, service-worker.js, manifest.webmanifest und icons/.
4. Öffne Repository -> Settings -> Pages.
5. Wähle "Deploy from a branch" -> Branch "main" -> Ordner "/ (root)" -> Save.
6. Die URL lautet anschließend in der Regel
   https://BENUTZERNAME.github.io/stammtisch-plus/
7. Öffne diese URL auf dem iPhone in Safari, tippe "Teilen" ->
   "Zum Home-Bildschirm" -> "Als Web-App öffnen" -> "Hinzufügen".
8. Öffne die App künftig über das Symbol auf deinem Home-Bildschirm.

Hinweis: Auf dem iPhone kann das Hochladen mehrerer Dateien inklusive des icons-Ordners
in GitHub unbequem sein. Nutze ggf. stattdessen die beiliegende Einzeldatei
"EIN_DATEI_INDEX.html" als index.html. Das spart Dateiuploads, bietet jedoch KEINE
Offline-Unterstützung. Eine normale HTTPS-Veröffentlichung wird weiter benötigt.

WICHTIG: Die veröffentlichte GitHub-Pages-Website und die dortigen QUELLCODE-Dateien
sind öffentlich sichtbar. Die einzelnen Mitgliederdaten liegen NICHT im Quellcode,
sondern lokal bzw. nach Cloud-Einrichtung in deiner geschützten Datenbank.

CLOUD (OPTIONAL, FÜR SICHERUNG UND SYNCHRONISIERUNG)
---------------------------------------------------
1. Erstelle auf https://supabase.com ein Supabase-Projekt.
2. Öffne dort SQL Editor und führe den Inhalt von "supabase-schema.sql" aus.
   Er erzeugt eine Tabelle mit Row-Level-Security; jeder Benutzer kann nur
   den eigenen Datensatz lesen und bearbeiten.
3. Kopiere aus Project Settings / API die "Project URL" und den öffentlichen
   "Publishable key" bzw. älteren "anon key". NICHT service_role/secret!
4. Öffne Stammtisch+ -> Mehr -> Cloud einrichten -> trage beide Werte ein.
5. Registriere dich in der App mit E-Mail/Passwort und bestätige ggf. die E-Mail.
6. Melde dich an und wähle beim ersten Abgleich, welche Daten du behalten willst.
7. Konfiguriere im Supabase-Dashboard die Auth-URL-Einstellungen passend
   zur veröffentlichten HTTPS-Adresse, wenn E-Mail-Bestätigungen eine
   Weiterleitung verwenden. Für produktive Nutzung die E-Mail-Zustellung prüfen.
8. Teste die Wiederherstellung und erstelle außerdem regelmäßig JSON-Backups.

Supabase-Projekt und GitHub-Konto sind separate Dienste. Tarife, Limits und
Datenschutzbedingungen des Anbieters vor Nutzung prüfen. Inhalte einschließlich
persönlicher Abwesenheitsgründe werden bei aktiver Cloud auf Supabase gespeichert.

DATEN & BERECHNUNGEN
--------------------
- Jahresrangliste: nur tatsächliche Anwesenheiten bei abgeschlossenen Treffen
  innerhalb des gewählten Kalenderjahres.
- Ewige Rangliste: historischer, einmalig eingegebener Teilnahme-Startwert
  plus automatisch gezählte Teilnahmen aus allen abgeschlossenen Treffen.
- Fällt ein Mitglied aus, wird der Grund frei eingegeben (Vorschläge verfügbar).
- Abwesenheit führt NIE automatisch zu einer Strafe.
- Eine Strafe kann bei einer Abwesenheit oder manuell angelegt werden.
- Zahlungen inkl. Teilzahlungen sind gesondert gespeichert; sie werden von
  der offenen Summe abgezogen.
- CSV-Dateien enthalten Semikolon-Trennzeichen und UTF-8-BOM für Excel.
- Backup und Import verwenden JSON.

OFFLINE-MODUS
------------
Die vollständige Version hat einen Service Worker und funktioniert nach einmaligem
Online-Laden größtenteils ohne Netzverbindung (Cloud-Abgleich erst wieder online).
Browser-/iOS-Speicher kann jedoch bei Speicherbereinigung gelöscht werden.
Deshalb Cloud-Synchronisierung und regelmäßige JSON-Sicherungen nutzen.

BESCHRÄNKUNGEN DIESER VERSION
----------------------------
- Keine Veröffentlichung oder App-Store-Anmeldung bereits durchgeführt.
- Kein Cloud-Konto für dich angelegt; Zugangsdaten musst du selbst einrichten.
- Cloud hat eine einfache Konflikt-Auswahl, keinen automatischen Feld-Merge.
- Echte iPhone-/Safari-Tests sind noch erforderlich; Entwicklungstest ist
  kein Ersatz für einen Test mit eigenen Daten und Geräten.
- Keine vollständige Buchhaltung im steuerrechtlichen Sinn, nur Strafen und
  deren Zahlungseingänge. Ausgaben sind derzeit nicht enthalten.
- Die App wird nicht durch einen iOS-Build installiert, sondern als Web-App.
- Sensible Gesundheitsangaben bei Abwesenheiten möglichst vermeiden.

DATEIEN
-------
index.html           Benutzeroberfläche, Stil und Metadaten
app.js               Logik, Speicherung, Auswertung und Cloud-Anbindung
service-worker.js    Offline-Cache
manifest.webmanifest Installation als App
icons/               App-Symbole
supabase-schema.sql  Datenbank & Zugriffsregeln
EIN_DATEI_INDEX.html Alternative mit nur einer Datei (ohne Offline-Cache)
