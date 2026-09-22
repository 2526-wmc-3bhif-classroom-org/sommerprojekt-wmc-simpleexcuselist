# Systemarchitektur – SimpleExcuseList

## 1. Überblick

**SimpleExcuseList** ist eine webbasierte Entschuldigungsverwaltung für Schulen. Schüler können ihre Abwesenheiten aus WebUntis einsehen und Entschuldigungen einreichen, Eltern können diese digital unterzeichnen, und Lehrkräfte können die Entschuldigungen ihrer Klasse verwalten und auswerten.

---

## 2. Technologie-Stack

| Schicht | Technologie |
|---|---|
| Frontend | Vue 3 (Composition API), TypeScript, Vite |
| Styling | Tailwind CSS, DaisyUI |
| Charts | ApexCharts (vue3-apexcharts) |
| State Management | Pinia |
| Routing (Frontend) | Vue Router v5 |
| Backend | Node.js, Express.js v5, TypeScript (tsx) |
| Datenbank | SQLite (better-sqlite3) |
| Authentifizierung | JWT (JSON Web Token), bcrypt |
| Externe API | WebUntis REST API |

---

## 3. Systemübersicht (Schichtenmodell)

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│                                                         │
│   ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│   │ StudentView │  │ TeacherView │  │  ParentView   │  │
│   └─────────────┘  └─────────────┘  └───────────────┘  │
│              Vue 3 SPA (Vite, Tailwind)                  │
│              Vue Router  |  Pinia                        │
└─────────────────────────────┬───────────────────────────┘
                              │ HTTP/JSON  (Bearer JWT)
                              │ /api/*
┌─────────────────────────────▼───────────────────────────┐
│                    Express.js Backend                    │
│                                                          │
│  authRouter  studentRouter  teacherRouter  parentRouter  │
│  attachmentRouter  infoRouter                            │
│                                                          │
│  Middleware:  verifyJwt  │  roleGuard  │  rateLimit      │
│                                                          │
│  Services / Repositories                                 │
│  untisService  │  absenceRepository  │  excuseRepository │
│  studentRepository  │  teacherRepository                 │
│  parentRepository   │  analyticsRepository               │
└───────────────┬──────────────────┬──────────────────────┘
                │                  │
         ┌──────▼──────┐   ┌───────▼────────┐
         │   SQLite DB  │   │  WebUntis API  │
         │ excuselist.db│   │ (htl-leonding) │
         └─────────────┘   └────────────────┘
```

---

## 4. Frontend-Architektur

### 4.1 Ordnerstruktur

```
src/
├── router/
│   └── index.ts          # Routen & JWT-basierte Guards
├── views/
│   ├── HomeView.vue       # Login-Seite
│   ├── StudentView.vue    # Schüler-Dashboard
│   ├── TeacherView.vue    # Lehrer-Dashboard
│   └── ParentView.vue     # Eltern-Dashboard
├── components/
│   ├── Login.vue          # Login-Formular
│   ├── LightingMode.vue   # Dark/Light-Mode Toggle
│   └── TimetableHeatmap.vue # Abwesenheits-Heatmap
├── utils/
│   └── subjectColor.ts    # Farbzuordnung für Fächer
└── assets/
    └── main.css           # Globale Styles
```

### 4.2 Routing & Zugriffskontrolle

Vue Router prüft bei jeder Navigation den JWT-Token aus dem `localStorage`. Der Token wird client-seitig dekodiert, um `role` und Ablaufzeit zu prüfen. Abgelaufene oder fehlende Tokens werden zur Login-Seite weitergeleitet.

```
/ (HomeView)        → Login
/student            → StudentView   [Guard: role === 'student']
/teacher            → TeacherView   [Guard: role === 'teacher']
/parent             → ParentView    [Guard: role === 'parent']
```

### 4.3 API-Kommunikation

Alle API-Aufrufe erfolgen über den nativen `fetch`-API mit dem JWT-Token im `Authorization: Bearer <token>`-Header. In der Entwicklung proxyt Vite `/api`-Anfragen zu `localhost:3000`.

---

## 5. Backend-Architektur

### 5.1 Ordnerstruktur

```
server/
├── src/
│   ├── index.ts            # Express App, Port 3000
│   ├── authRouter.ts       # POST /api/login
│   ├── studentRouter.ts    # GET  /api/absences, POST /api/excuses/submit
│   ├── teacherRouter.ts    # Lehrer-Endpunkte, Analytik
│   ├── parentRouter.ts     # GET/POST Eltern-Endpunkte
│   ├── attachmentRouter.ts # Dateianhänge (Download)
│   └── infoRouter.ts       # Allgemeine Infos
├── data/
│   ├── unit.ts             # SQLite-Verbindung & Transaktionen
│   ├── untisClient.ts      # WebUntis API-Client
│   ├── untisService.ts     # WebUntis Sync-Logik
│   ├── studentRepository.ts
│   ├── parentRepository.ts
│   ├── teacherRepository.ts
│   ├── excuseRepository.ts
│   ├── absenceRepository.ts
│   └── analyticsRepository.ts
├── middleware/
│   ├── auth.ts             # JWT-Verifikation
│   ├── roleGuard.ts        # Rollenbasierte Zugriffskontrolle
│   └── rateLimit.ts        # 10 Logins / 15 Min. pro IP
└── config/
    └── env.ts              # Umgebungsvariablen-Validierung
```

### 5.2 API-Endpunkte

| Methode | Endpunkt | Rolle | Beschreibung |
|---|---|---|---|
| POST | `/api/login` | Alle | Login (Untis / Teacher / Parent) |
| GET | `/api/absences` | Student | Eigene Abwesenheiten abrufen |
| POST | `/api/excuses/submit` | Student | Entschuldigung einreichen |
| GET | `/api/student/analytics` | Student | Statistiken & Heatmap |
| GET | `/api/teacher/students` | Teacher | Schülerliste der Klasse |
| GET | `/api/teacher/students/:id/absences` | Teacher | Abwesenheiten eines Schülers |
| GET | `/api/parent/excuses` | Parent | Offene Entschuldigungen |
| POST | `/api/parent/absences/:id/sign` | Parent | Entschuldigung unterzeichnen |
| GET | `/api/absences/:id/attachments` | Parent/Teacher | Anhänge herunterladen |

### 5.3 Middleware-Pipeline

```
Request
  └─► rateLimit (nur /api/login)
        └─► verifyJwt (alle /api/* außer /login)
              └─► requireRole (student | teacher | parent)
                    └─► Router-Handler
                          └─► Repository
                                └─► SQLite
```

---

## 6. Authentifizierung

### 6.1 Login-Flows

**Schüler** (via WebUntis):
1. Credentials werden gegen die WebUntis-API validiert
2. Schüler wird in der Datenbank angelegt oder aktualisiert
3. Eltern-Account wird automatisch erstellt
4. JWT wird ausgestellt; Stundenplandaten werden asynchron synchronisiert

**Lehrer**:
1. Credentials werden gegen die `Teacher`-Tabelle geprüft (bcrypt)
2. JWT mit `teacherId`, `className`, `username`

**Eltern**:
1. Credentials werden gegen die `Parent`-Tabelle geprüft
2. JWT mit `parentId`, `username`

### 6.2 JWT-Payload

```typescript
{
  role: 'student' | 'teacher' | 'parent',
  untisId?: number,      // Schüler
  teacherId?: string,    // Lehrer
  className?: string,    // Lehrer
  parentId?: string,     // Eltern
  username?: string,
  exp: number            // 1 Stunde Gültigkeit
}
```

Token-Speicherort: `localStorage` unter dem Key `untis_jwt`.

---

## 7. Datenbankschema

```
Student (untisId PK, firstName, lastName, className, lastSync)
    │
    ├── StudentParent (parentId FK, studentUntisId FK)
    │       └── Parent (id PK, username, passwordHash, name)
    │
    ├── Absence (id PK, untisId UNIQUE, date, startTime, endTime,
    │           status, excuseMessage, excuseParentId FK)
    │       └── Attachment (id PK, absenceId FK, fileName, fileData)
    │
    ├── AbsenceLesson (id PK, subjectName, date, startTime, endTime, absenceStatus)
    │
    └── StudentScheduledLesson (id PK, date, startTime, endTime, subjectName)

Teacher (id PK, username, passwordHash, className)

StudentSyncState (studentUntisId PK, lastSynced)
```

**Abwesenheitsstatus-Workflow:**

```
open ──► pending (Schüler reicht ein) ──► signed (Eltern unterzeichnen)
                                              └──► excused   (Lehrer)
                                              └──► unexcused (Lehrer)
```

### 7.1 Transaktionsmuster

Die `Unit`-Klasse kapselt jede SQLite-Operation in einer Transaktion:

```typescript
const db = new Unit(readOnly);
try {
  db.prepare(sql).run(params);
  db.complete(true);   // COMMIT
} catch {
  db.complete(false);  // ROLLBACK
}
```

---

## 8. WebUntis-Integration

Der `untisClient.ts` kommuniziert direkt mit der WebUntis REST API. Nach jedem Schüler-Login läuft ein Hintergrund-Sync:

```
Login-Request
    └─► WebUntis: authenticate()
          └─► Abwesenheiten abrufen (getAbsentLesson)
                └─► Stundenplan abrufen (getTimetable, ab Schuljahresbeginn)
                      └─► Abwesenheiten mit Lektionen abgleichen
                            └─► AbsenceLesson-Einträge in DB schreiben
                                  └─► WebUntis: logout()
```

Konfigurierbar für zwei Schulen:

```
UNTIS_SCHOOL=htl-leonding     UNTIS_BASE_URL=htl-leonding.webuntis.com
UNTIS_SCHOOL_2=htltraun       UNTIS_BASE_URL_2=htltraun.webuntis.com
```

---

## 9. Datei-Anhänge

Anhänge (Arztbestätigungen etc.) werden als Base64-Data-URLs in der Datenbank gespeichert (Tabelle `Attachment`). Erlaubte Formate: PDF, PNG, JPG. Maximale Dateigröße: 5 MB pro Datei, 22 MB gesamt (Express Body-Limit).

---

## 10. Entwicklungsumgebung

```
npm run dev          # Frontend (Vite :5173) + Backend (tsx :3000) parallel
npm run dev:vite     # Nur Frontend
npm run server       # Nur Backend (tsx watch)
npm run build        # Produktions-Build (dist/)
```

Vite proxyt in der Entwicklung alle `/api`-Anfragen zu `http://localhost:3000`.

---

## 11. Umgebungsvariablen

| Variable | Beschreibung | Pflicht |
|---|---|---|
| `JWT_SECRET` | Signierungsschlüssel für JWTs | Ja |
| `UNTIS_SCHOOL` | WebUntis Schulname | Ja |
| `UNTIS_BASE_URL` | WebUntis Basis-URL | Ja |
| `UNTIS_SCHOOL_2` | Zweite Schule (optional) | Nein |
| `UNTIS_BASE_URL_2` | Zweite Schule URL (optional) | Nein |
| `PORT` | Backend-Port (Standard: 3000) | Nein |
