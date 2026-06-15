# Technical Workflow: WebUntis Integration

This document explains how the authentication and absence-fetching process works in the SimpleExcuseList application.

## 1. Architecture Overview
The system uses a **Proxy Pattern** to communicate with WebUntis. This is necessary because:
- **CORS:** Browser security policies (CORS) prevent the Vue.js frontend from calling the WebUntis API directly.
- **Security:** The proxy handles the WebUntis session management without exposing permanent credentials to the frontend.

## 2. Authentication Flow

### A. Frontend Login (`Login.vue`)
1. User enters their standard school **Username** and **Password** into the DaisyUI form.
2. The form sends a `POST` request to the backend proxy (`http://localhost:3000/api/login`).

### B. Backend Verification (`server/index.ts`)
1. The backend receives the credentials.
2. It initializes a new `WebUntis` instance using the school (`htl-leonding`) and the server URL.
3. It attempts a `untis.login()`.
4. **Success:** If login works, the backend generates a **JWT (JSON Web Token)**. This token contains the username and password (encrypted/secured by the JWT secret).
5. **Response:** The JWT is sent back to the frontend.

### C. Token Storage
1. The frontend receives the JWT and stores it in `localStorage` under the key `untis_jwt`.
2. The user is then redirected to the `/student` dashboard.

## 3. Fetching Absences Flow

### A. Authorization
1. When `StudentView.vue` mounts, it retrieves the JWT from `localStorage`.
2. It sends a `GET` request to `/api/absences` with the JWT in the `Authorization: Bearer <token>` header.

### B. Backend Proxy Action
1. The backend verifies the JWT using the `JWT_SECRET`.
2. It extracts the credentials and logs into WebUntis again to establish a fresh session.
3. It calls `untis.getAbsentLesson(startDate, endDate)`.
   - The date range is currently set from the start of the school year (Sept 1st) to the current date.

### C. Filtering Logic
WebUntis returns *all* absences. Per the project requirements, the backend filters this list:
```typescript
const filteredAbsences = absences.filter((a: any) => {
  return a.isExcused === false && !a.excuseStatus;
});
```
- `isExcused === false`: Only items not yet marked as excused by the system.
- `!excuseStatus`: Only items that don't have a pending excuse status.

### D. Frontend Rendering
1. The backend sends the filtered JSON array back to the frontend.
2. `StudentView.vue` receives the data:
   - **Dates/Times:** Formats WebUntis integers (e.g., `20260324` and `1422`) into readable strings (`24.03.2026` and `14:22`).
   - **UI:** Renders the table using Tailwind CSS and DaisyUI.
   - **Empty State:** If the filtered list is empty, it displays a "No unexcused absences" message.

## 4. Key Technologies
- **Vite/Vue 3:** Frontend framework.
- **Express (Node.js):** Backend proxy server.
- **WebUntis (NPM):** Library used to interact with the WebUntis JSON-RPC API.
- **JSON Web Tokens (JWT):** Securely passing session information between frontend and backend.

i want to deploy this web app to a proxmox container in my school private network so its accassible for people in my class.
For deployment i was thinking to install nginx in the container to serve the files and dockerize my app and run one instance of the app and connect the ports and maybe even switch to postgressql and make another container for db so i have two (app and db) and then i can use docker composevto start both.
I want you to read through the entire code and look for security issues (there are probably many).
other students will try to find a way to bypass the security issues and break it or get data they are not suppposed to.
So think like a hacker and tell me what issues need to be fixed. USer date protection,url, authetication,ddos,...
Furthermore, if you have any general tips for deployment for this case, please let me know.