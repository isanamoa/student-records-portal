# Student Records Portal – ICS570 Assignment

Secure university portal demonstrating **WebAuthn/FIDO2 passkey authentication** and **server-side role-based + ownership authorization**.

## Prerequisites

- Node.js 18+ (LTS recommended)
- Modern browser with WebAuthn support (Chrome, Edge, Safari, Firefox)
- Platform authenticator (Windows Hello, Touch ID, Face ID) **or** a virtual authenticator (Chrome DevTools → Application → WebAuthn)

## Installation

```bash
npm install
cp .env.example .env          # edit SESSION_SECRET if desired
npm run seed                  # creates S001, S002, L001 + C101
npm start                     # http://localhost:3000
```

## Test Accounts (synthetic)

| ID   | Username | Role     | Notes                          |
|------|----------|----------|--------------------------------|
| S001 | s001     | student  | Can view only own record       |
| S002 | s002     | student  | Can view only own record       |
| L001 | l001     | lecturer | Assigned to course C101 only   |

## Browser / Authenticator Setup

1. Open `http://localhost:3000` (must match the `ORIGIN` in `.env`).
2. Use a real platform authenticator or enable a virtual authenticator in Chrome DevTools.
3. First-time users must **Register Passkey**, then **Sign in with Passkey**.

## How to Reproduce T1–T8

| Test | Steps |
|------|-------|
| **T1** | Enter `s001` → Register Passkey → complete authenticator prompt. Credential stored against S001. |
| **T2** | Enter `s001` → Sign in with Passkey → session created, dashboard shown. |
| **T3** | Capture a valid authentication response (DevTools Network), alter a field (e.g. challenge or signature), replay via curl/Postman → server rejects, no session. |
| **T4** | Open a private window or clear cookies → `GET /students/S001` → 401. |
| **T5** | Logged in as S001 → `GET /students/S001` (or UI “My Academic Record”) → 200 Allowed. |
| **T6** | Logged in as S001 → change URL or call `GET /students/S002` → 403 Forbidden (server-side). |
| **T7** | Logged in as S001 → `POST /courses/C101/grades/S002` with body `{"value":99}` → 403, grade unchanged. |
| **T8** | Logged in as L001 → update grade for S001 in C101 via UI or `POST /courses/C101/grades/S001` → 200 Allowed. |

## Technology Stack

- Node.js + Express
- `@simplewebauthn/server` for WebAuthn verification
- better-sqlite3 (local file DB)
- express-session (server-side sessions)
- Vanilla HTML/JS frontend

## Project Structure

```
student-records-portal/
├── package.json
├── .env.example
├── README.md
├── scripts/seed.js
├── src/
│   ├── server.js
│   ├── config.js
│   ├── db/          (schema + connection)
│   ├── middleware/  (auth + authorization)
│   ├── routes/      (auth, students, courses)
│   └── services/    (webauthn helpers)
└── public/          (frontend)
```

## AI / Tools Declaration

AI assistance (Grok) and VS Code Agent was used for project scaffolding, generating the initial Express + SimpleWebAuthn structure, and producing this evidence-report template. I personally implemented and verified the authorization middleware (requireOwnStudentOrLecturer and requireLecturerForCourse), executed every test T1–T8 against the running application, captured the Network and curl evidence, and wrote the security interpretation referring to those results. All observed outcomes and the analysis above reflect my own testing and reasoning.
