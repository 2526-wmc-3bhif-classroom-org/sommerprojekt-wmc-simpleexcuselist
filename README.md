# Simple Excuse List

**Simple Excuse List** ist die digitale Entschuldigungsliste für Schulen – schnell, einfach und sicher.  
Unsere Plattform ist als **Mobile App** und **Web Application** verfügbar und erleichtert den täglichen Ablauf in Schulen erheblich.


## 1. Problemstellung
Das aktuelle Entschuldigungssystem ist papierbasiert und ineffizient.

### Herausforderungen für Schüler
* **Verlustgefahr:** Physische Zettel gehen leicht verloren.
* **Medienbruch:** Zusätzliche Schritte wie Foto machen, PDF erstellen und manuelles Hochladen sind zeitaufwendig.
* **Mangelnde Transparenz:** Kein Überblick über bereits abgegebene oder noch ausstehende Entschuldigungen.

### Herausforderungen für Lehrkräfte
* **Lesbarkeit:** Handschriftliche Entschuldigungen sind oft schwer zu entziffern.
* **Verwaltungsaufwand:** Manuelle Nachverfolgung und fehlende strukturierte Daten.
* **Mustererkennung:** Auffällige Fehlmuster bei Abwesenheiten sind schwer identifizierbar.

---

## 2. Zielsetzung
Entwicklung einer zentralen Webanwendung zur digitalen Verwaltung von Fehlzeiten:
* **Digitales Einreichen** statt Zettelwirtschaft.
* **Sichere Speicherung** und Verknüpfung mit Schulaccounts.
* **Strukturierte Auswertung** für Lehrkräfte.
* **Nachvollziehbarkeit** durch lückenlose Historie.

> **Hinweis:** Das System ersetzt nicht das Vertrauen zwischen Schule und Elternhaus, sondern schafft eine zeitgemäße Struktur.

---

## 3. Benutzerrollen & Authentifizierung
Die Anmeldung erfolgt über bestehende Schulzugangsdaten. Das System erkennt automatisch:
* **Rolle:** Schüler oder Lehrer.
* **Zuordnung:** Klasse des Schülers und zuständiger Klassenvorstand.
* **Sicherheit:** Keine manuelle Registrierung nötig, dadurch Ausschluss von Fake-Accounts.

---

## 4. Features: Schüler-Bereich

### 4.1 Dashboard & Status
Schüler verwalten ihre Fehlzeiten in einer übersichtlichen Tabelle:

| Datum | Stunden | Grund | Signatur | Anhänge | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 01.03.2026 | 1–4 | Krankheit | Vorhanden | Arzt.pdf | `Pending` |

### 4.2 Signatursystem & Validierung
* **Digitale Signatur:** Eltern unterschreiben direkt im Browser (Touch/Maus), ähnlich wie bei Paketdienstleistern.
* **Dateiupload:** Pflichtfeld für Anhänge, falls vom Lehrer gefordert (z. B. ärztliches Attest).
* **Bearbeitungsschutz:** Einträge können nur bearbeitet werden, solange sie auf `Pending` stehen.

---

## 5. Features: Lehrer-Bereich

### 5.1 Verwaltung & Prüfung
* **Klassenübersicht:** Schneller Zugriff auf alle Schüler der eigenen Klasse.
* **Entscheidungs-Workflow:**
    * `Accepted`: Entschuldigung wird archiviert.
    * `Rejected`: Ablehnung mit verpflichtender Begründung an den Schüler.
* **Individuelle Regeln:** Lehrer können für einzelne Schüler die Funktion "Nachweis erforderlich" erzwingen.

### 5.2 Analyse-Dashboard
Basierend auf den Daten (und optionaler Stundenplan-Integration) bietet das System:
* Gesamtanzahl der Fehltage/-stunden.
* Analyse der Fehlzeiten nach Wochentagen.
* **Deep Dive:** Fehlzeiten pro spezifischem Fach.




