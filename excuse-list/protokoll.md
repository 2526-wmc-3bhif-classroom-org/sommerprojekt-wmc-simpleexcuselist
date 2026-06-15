# Projekt-Protokoll

## Feature: Datenbankanbindung & Livedaten in der TeacherView

* **Datenbank Setup (`server/index.ts`)**: Die Bibliothek `better-sqlite3` wurde eingebunden. Beim Serverstart wird nun automatisch eine SQLite-Tabelle namens `excuses` (mit den Feldern id, status, reason) erstellt, falls diese noch nicht existiert.
* **Neuer API-Endpunkt (`server/index.ts`)**: Ein `PUT /api/excuses/:id` Endpunkt wurde hinzugefügt. Dieser nimmt Änderungen an Entschuldigungen (Status & Grund) entgegen und speichert diese in der Datenbank (Upsert: erstellt neu oder updatet existierende).
* **Daten zusammenführen (`server/index.ts`)**: Der bestehende `GET /api/absences` Endpunkt wurde so modifiziert, dass er die Livedaten von WebUntis holt und diese mit den lokal gespeicherten Status- und Grundänderungen aus der SQLite-Datenbank abgleicht und überschreibt.
* **TeacherView angebunden (`src/views/TeacherView.vue`)**: Die hardcodierten Testdaten wurden entfernt. Stattdessen ruft die Komponente beim Laden (`onMounted`) die Livedaten über `fetch()` ab. Es wurden zudem Lade-Spinner und Fehleranzeigen hinzugefügt.
* **UI Speichern-Logik (`src/views/TeacherView.vue`)**: Die `saveChanges` Funktion schickt nun die im Modal getätigten Änderungen an den neuen Backend-Endpunkt.
* **Bugfix Authentifizierung (`src/views/TeacherView.vue`)**: Der LocalStorage-Schlüssel für das JWT-Token wurde von dem Standardwert `token` auf den im Projekt verwendeten Namen `untis_jwt` korrigiert, damit die API-Requests erfolgreich authentifiziert werden.
* **Lokale Dateien ignoriert (`.gitignore`)**: Die lokale Datei `chat.md` wurde in die `.gitignore` aufgenommen, damit sie nicht in das GitHub-Repository hochgeladen wird.