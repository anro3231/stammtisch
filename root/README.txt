STAMMTISCH+ v2 – GITHUB PAGES / iPHONE
==================================
Stand: 15.10.2026

NEU IN VERSION 2
----------------
1. Je Mitglied: historische Teilnahmen 2026 bis zum Einführungszeitpunkt
   ('Startwert 2026') einmalig eingeben, einzeln oder für alle Mitglieder
   auf einmal unter Mitglieder -> 2026-Startwerte erfassen.
2. Je Mitglied: eindeutige positive Mitgliedsnummer (auch nachträglich).
3. Neuer Stammtisch: Organisator wird automatisch vorgeschlagen. Reihenfolge:
   Nächsthöhere Mitgliedsnummer des letzten dokumentierten Organisators;
   nach der höchsten Nummer zurück zur kleinsten aktiven Mitgliedsnummer.
   Die Vorauswahl ist änderbar. Mitglieder ohne Nummer und archivierte
   Mitglieder werden bei der automatischen Vergabe übersprungen.

WICHTIGE ZÄHLREGELN
-------------------
- Ewige Rangliste = alter historischer Gesamt-Startwert + alle neu erfassten
  Teilnahmen. Der neue 2026-Startwert wird NICHT ein zweites Mal addiert.
- Jahresrangliste 2026 = 2026-Startwert + neu in der App dokumentierte
  abgeschlossene Treffen von 2026, bei denen das Mitglied anwesend war.
- Andere Jahresranglisten = nur erfasste abgeschlossene Treffen dieses Jahres.
- Trage bei '2026-Startwert' NUR 2026-Teilnahmen ein, die noch nicht einzeln
  in dieser App dokumentiert sind.
- Der historische Gesamt-Startwert MUSS die 2026-Startwert-Teilnahmen bereits
  enthalten. Der 2026-Startwert darf deshalb nicht höher als der Gesamtwert sein.
- Strafen, Abwesenheitsgründe und Organisator zählen NICHT zur Rangliste.
- Nicht abgeschlossene oder zukünftige Stammtische zählen nicht.

UPDATE BESTEHENDER GITHUB-PAGES-INSTALLATION (empfohlen)
--------------------------------------------------------
0. WICHTIG: Vorher auf der bisherigen App-Seite unter Mehr ->
   'Komplette Datensicherung (JSON)' exportieren und die Datei sicher verwahren.
1. Wenn du die ALTE EIN-DATEI-VERSION nutzt: Die mitgelieferte Datei
   'EIN_DATEI_INDEX.html' in 'index.html' umbenennen und die vorhandene
   'index.html' im bisherigen GitHub-Repository ersetzen.
   Noch einfacher ist die separate ZIP nur mit einer Datei (index.html).
2. Wenn du die VOLLSTÄNDIGE WEB-APP nutzt: Im bisherigen Repository die
   Dateien aus diesem Paket aktualisieren (insbesondere app.js,
   index.html, service-worker.js, manifest.webmanifest und icons/).
3. Auf derselben GitHub-Pages-Adresse in Safari neu laden. Bei einer
   installierten Home-Bildschirm-Web-App ggf. schließen und erneut öffnen.
4. Prüfe unter Mitglieder, ob alle bisherigen Daten noch vorhanden sind,
   und ergänze Mitgliedsnummern sowie die 2026-Startwerte.
5. Wenn keine Daten erscheinen: NICHT neu erfassen. Prüfe zuerst, ob
   dieselbe Webadresse bzw. derselbe Browser/Speicherkontext verwendet wird.
   Ggf. JSON-Backup über Mehr importieren.

Hinweis: Lokale Daten liegen im Browserspeicher der bisherigen Webadresse,
NICHT im GitHub-Repository. Der App-Code wird beim Update ersetzt,
aber die gespeicherten Daten bleiben bei gleicher Webadresse/Speicherumgebung
in der Regel bestehen. Das ist keine Garantie; das JSON-Backup ist wichtig.
GitHub Pages ist öffentlich: niemals echte Stammtischdaten, Backups oder
Supabase-Geheimschlüssel in das öffentliche GitHub-Repository hochladen.

NEU VERÖFFENTLICHEN – NUR MIT IPHONE
-----------------------------------
1. GitHub-Konto anlegen oder anmelden: https://github.com
2. Öffentliches Repository z. B. 'stammtisch-plus' erstellen.
3. Für einfaches Hochladen: separate Ein-Datei-Version verwenden.
   Darin liegt bereits die fertige Datei 'index.html'. Diese direkt in das
   Hauptverzeichnis des Repositorys hochladen (nicht die ZIP-Datei).
4. Repository -> Settings -> Pages -> Deploy from a branch ->
   Branch main, Ordner / (root) -> Save.
5. Nach Veröffentlichung die Pages-Adresse in Safari auf dem iPhone öffnen.
6. Safari -> Teilen -> Zum Home-Bildschirm hinzufügen. Wenn angeboten:
   'Als Web-App öffnen' wählen.
7. Die App anschließend über das Home-Bildschirm-Symbol öffnen.

Beispieladresse:
https://DEIN-BENUTZERNAME.github.io/stammtisch-plus/

Ein-Datei-Version: nur index.html; keine Service-Worker-Offlinespeicherung.
Die Daten werden auf dem Gerät in localStorage gespeichert und bleiben bei
normaler Nutzung erhalten, sind aber nicht als unfehlbar oder automatisch
extern gesichert anzusehen. Für zuverlässigeren Offline-App-Betrieb die
vollständige Mehr-Dateien-Version veröffentlichen.

DATEIEN
-------
index.html             HTML und Gestaltung
app.js                 gesamte Anwendungslogik
manifest.webmanifest   iPhone-/PWA-Metadaten
service-worker.js      Offline-Cache für die Mehr-Dateien-Version
icons/                 App-Symbole
supabase-schema.sql    optionale persönliche Supabase-Cloud-Datenbank
EIN_DATEI_INDEX.html   eigenständige Datei, als index.html hochladen
test-logic.cjs         ursprüngliche Logiktests
test-v2.cjs            Tests für die neuen Funktionen

CLOUD (OPTIONAL)
----------------
Die bestehende Supabase-Anbindung bleibt unverändert erhalten. Kein neuer
SQL-Migrationsschritt nötig, weil die Dokumente als JSON gespeichert werden.
In der App unter Mehr -> Cloud einrichten kannst du eine private Datenbank
verbinden. Nicht mit einem geheimen service_role-Key arbeiten. Zugang und
Nutzung eines Supabase-Kontos müssen selbst eingerichtet werden. Bei
mehreren Geräten Konflikte bewusst behandeln und Backups anfertigen.

WEITERE HINWEISE
----------------
- Die komplette Web-App erfordert HTTPS (z. B. GitHub Pages).
- Mitgliedsnummern können nachträglich geändert werden; die Organisatorfolge
  richtet sich danach bei neu angelegten Treffen entsprechend neu aus.
- Bestehende Treffen behalten ihren bisher gespeicherten Organisator.
  Historische Treffen aus alter Version haben zunächst keinen Organisator.
- Auch bei aktiviertem Service Worker kann Safari Speicher entfernen.
  Deshalb unbedingt regelmäßig JSON-Sicherungen außerhalb der Web-App ablegen.
- Lokale Daten auf dem Gerät sind ohne zusätzliche Schutzmaßnahmen nur durch
  Gerätesperre/Browsersicherheitsmodell geschützt; unnötig sensible Gründe
  möglichst nicht erfassen.
- Diese Version wurde automatisch per Syntaxprüfung und JavaScript-Logiktests
  geprüft; ein echter iPhone-Safari-End-to-End-Test steht noch aus.
