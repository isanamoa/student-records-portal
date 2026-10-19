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

## AES-GCM Encryption Demonstration

Run the demonstration from the portal's **Security Lab** card, or from the
command line:

```bash
npm run demo:aes-gcm
```

Both entry points use `src/services/aes-gcm-demo.js` and Node.js's established
built-in `node:crypto` library. In the portal, sign in and select an authorized
student record in the Security Lab. Students can encrypt only their own record;
lecturers can select records in their course roster. The server reads the
student and grade data from SQLite and encrypts the JSON with AES-256-GCM.
Press **Encrypt record**, then **Run integrity test** to alter one byte in a
temporary ciphertext copy and display a timestamped tamper-detection log in the
card. A **PASS** means AES-GCM rejected the modified data; the original envelope
is preserved. Finally, press **Decrypt record** to authenticate and decrypt that
envelope and compare the recovered bytes to the original JSON. Capture the
visible tamper-test log in a screenshot, or run `npm test` to verify the
automated integrity test.

During encryption, the service encrypts twice with one randomly generated
256-bit key and checks that each encryption receives a distinct, random
96-bit nonce.

The service flips a bit in a local copy of the ciphertext. GCM authentication
must fail during decryption; altered plaintext is never returned as valid
data. The demonstration key and pending encrypted record remain in server
memory for at most five minutes, bound to the authenticated session and student
record, and are removed after decryption. They are not sent to the browser or
stored persistently. The encrypted envelope and decrypted record are shown as
authorized demonstration output; this does not encrypt or replace the
database's stored records.

Never reuse a nonce with the same AES-GCM key. Reuse can compromise
confidentiality and authentication, allowing relationships between plaintexts
to be exposed and making forgeries possible. Generate a new random nonce for
each encryption, and store or transmit the nonce and authentication tag with
the ciphertext (they are not secret).

Run the automated demo checks with `npm test`.
The CLI command reads S001 from the local database, so run `npm run seed`
before `npm run demo:aes-gcm` if the database has not been seeded.

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
├── scripts/
│   ├── seed.js
│   └── demo-aes-gcm.js
├── tests/
│   └── aes-gcm-demo.test.js
├── src/
│   ├── server.js
│   ├── config.js
│   ├── db/          (schema + connection)
│   ├── middleware/  (auth + authorization)
│   ├── routes/      (auth, students, courses, security demo)
│   └── services/    (webauthn + AES-GCM helpers)
└── public/          (frontend)
```

## AI / Tools Declaration

AI assistance (Grok) and VS Code Agent was used for project scaffolding, generating the initial Express + SimpleWebAuthn structure, and producing this evidence-report template. I personally implemented and verified the authorization middleware (requireOwnStudentOrLecturer and requireLecturerForCourse), executed every test T1–T8 against the running application, captured the Network and curl evidence, and wrote the security interpretation referring to those results. All observed outcomes and the analysis above reflect my own testing and reasoning.
