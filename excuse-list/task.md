# Project: WebUntis Integration for SimpleExcuseList

## Overview
The goal is to allow students to log in using their HTL Leonding WebUntis credentials, authenticate via a Node.js backend, fetch their unexcused absences, and display them in a Vue.js `StudentView.vue` component.

## Technical Stack
- **Frontend:** Vue 3, TypeScript, Tailwind CSS, DaisyUI.
- **Backend:** Node.js with Express and `webuntis` library (NPM).
- **Authentication:** WebUntis Session-based (Proxy).

---

## Task 1: Backend Proxy (Node.js + TypeScript)
We need an Express server to bypass CORS and interact with the WebUntis JSON-RPC API.

### Requirements:
1. **Dependencies:** `npm install webuntis express cors dotenv jsonwebtoken`.
2. **Environment Variables:** - `UNTIS_SCHOOL=htl-leonding`
    - `UNTIS_BASE_URL=htl-leonding.webuntis.com`
3. **Endpoints:**
    - `POST /api/login`: Accepts `username` and `password`.
        - Use `new WebUntis(school, user, pass, url)` to authenticate.
        - If successful, return a JWT (JSON Web Token) containing the username and a temporary session secret.
    - `GET /api/absences`:
        - Use the credentials/session to call `getAbsencesForSchoolyear()`.
        - Filter the results where `isExcused === false`.
        - Return the filtered list to the frontend.

---

## Task 2: Login Interface (Login.vue)
Create a clean login form using DaisyUI components.

### Requirements:
1. **Form Fields:** Username and Password.
2. **Logic:**
    - On submit, POST the credentials to the local Backend `/api/login`.
    - On success, store the returned JWT in `localStorage`.
    - Redirect the user to `/student-dashboard`.
3. **Styling:** Use a "Card" layout with a focus on mobile-first design.

---

## Task 3: Student Dashboard (StudentView.vue)
Display the "Open" absences fetched from the backend.

### Requirements:
1. **Data Fetching:** - On `onMounted`, call the Backend `GET /api/absences` using the JWT for authorization.
2. **State Management:**
    - Store the list of absences in a reactive `ref`.
3. **UI Components:**
    - Display a "Empty State" if 0 absences are found.
    - Use a list or table to show: **Date**, **Start/End Time**, and **Reason/Subject**.
    - Add a "Sign/Excuse" button for each item (to be linked to the excuse-generation logic later).
4. **TypeScript Interfaces:**
    - Define an `Absence` interface matching the WebUntis object structure (id, date, startTime, endTime, text, isExcused).

---

## Crucial Implementation Details (Notes for AI)
- **CORS:** Ensure the Express backend has `cors()` enabled to allow requests from the Vue dev server (usually port 5173).
- **Security:** Do not store the WebUntis password in the database. Use it only for the initial authentication.
- **Untis Server:** Specifically use `htl-leonding.webuntis.com` for the server parameter.
- **Absence Filtering:** WebUntis returns all absences; the logic must strictly filter for `!absence.isExcused` and `!absence.excuseStatus`.