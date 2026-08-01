# HRCD Employee Training Management System

A simple training management system for the Human Resources and Career Development
department — a React frontend talking to a Node.js/Express + SQLite backend.

## Stack

- **Backend:** Node.js + Express, in `backend/`
- **Database:** SQLite (via Node's built-in `node:sqlite`, no native build tools or DB server required)
- **Frontend:** React + Vite, in `frontend/`, styled with Tailwind CSS (icons from Bootstrap Icons — just the icon font, no Bootstrap framework)
- **File uploads:** Multer (stored under `backend/uploads/`)
- **Excel export:** ExcelJS

## Project layout

```
hrms/
├── backend/
│   ├── server.js              Express app entry point — API + serves the built frontend
│   ├── db/
│   │   ├── database.js        SQLite schema + connection + settings (session secret, invite code)
│   │   └── sqliteSessionStore.js  Custom express-session Store backed by SQLite (persists across restarts)
│   ├── middleware/requireAuth.js  Session-check middleware guarding the HR-only API routes
│   ├── routes/                One file per resource (auth, users, trainings, nominees, evidence, confirm, dashboard, reports)
│   ├── scripts/create-user.js CLI to bootstrap the first HR login
│   ├── scripts/reset-password.js CLI to reset an HR user's password if nobody else can
│   ├── public/confirm.html    The one page that stays outside the React app (see below)
│   └── uploads/                Uploaded evidence files
└── frontend/
    ├── index.html
    ├── vite.config.js         dev-server proxy → localhost:3000/api
    └── src/
        ├── main.jsx, App.jsx  entry point + router
        ├── api/client.js      fetch wrapper for the backend API
        ├── context/           AuthContext (session state), ToastContext
        ├── components/        NavBar, Modal, ProtectedRoute, form modals
        └── routes/            Login, Signup, Dashboard, Trainings, TrainingDetail, Reports, Users
```

`confirm.html` is a plain static HTML page (not part of the React app) that employees
open via a link to confirm their own training attendance, without needing an HR login.
It's served by the backend directly, at the same path in both dev and production.

## Running it

### Development (two terminals)

```bash
# terminal 1 — backend API on :3000
cd backend
npm install
npm start

# terminal 2 — React app on :5173
cd frontend
npm install
npm run dev


Open **http://localhost:5173** — the Vite dev server proxies `/api/*` and `/confirm.html`
to the backend on :3000, so you only ever need to open the :5173 URL(development).

### Production


# build the frontend
cd frontend
npm install
npm run build

# then run the backend, which serves the built frontend itself
cd ../backend
npm install
npm start
```

Open **http://localhost:3000** — this is now the only URL you need; the backend serves
the React app's static files directly, with a fallback so client-side routes (e.g.
`/trainings/5`) work on a hard refresh or direct link. Re-run `npm run build` in
`frontend/` whenever frontend code changes.

### First-time setup: create an HR login

There's no public sign-up for the very first account; create it from the command line:

```bash
cd backend
node scripts/create-user.js <username> <password> <full name>
```

Example:

```bash
node scripts/create-user.js maurice "MyStrongPass1" Maurice Admin
```

Once signed in, additional HR staff accounts can be added two ways:

1. From the **HR Users** page in the app (an existing HR user picks the username/password).
2. **Self-service**: share the invite code shown on the HR Users page, plus a link to
   `/signup`, with a colleague — they pick their own username and password without you
   ever seeing or sharing a password. Regenerate the code any time from the same page
   to revoke it (e.g. after everyone who needs it has signed up).

### Forgot a password?

There's no email-based "forgot password" flow (the app doesn't send email at all — see
the self-confirmation note below). Instead:

- **Someone else is still signed in:** any HR user can reset any other user's password
  from the HR Users page (the key icon next to their row) — no need to know their old one.
- **Nobody else has access:** reset it from the server directly:
  ```bash
  cd backend
  node scripts/reset-password.js <username> <new-password>
  ```

- The app calls `app.set('trust proxy', 1)`, which is correct for Render's standard
  single reverse-proxy setup.
- Login, signup, and the employee confirmation endpoint are all rate-limited (20
  requests per 15 minutes per IP) to slow down password/invite-code guessing. A real
  user mistyping their password a few times won't notice; if you see `429` responses,
  that's this limiter — wait 15 minutes (the limiter's counters are in-memory, so a
  redeploy also clears them).
- Re-run the frontend build (`npm run build` in `frontend/`) whenever frontend code
  changes — Render's build command does this automatically on every deploy, so you
  only need to think about this if you're testing locally in "production mode."

## Features

- **Authentication** — HR staff must sign in (username/password) to use the system.
  Sessions are cookie-based and expire after 8 hours of inactivity. Signed-in staff
  can add or remove other HR accounts from the HR Users page (you can't remove your
  own account, and the last remaining account can't be deleted), and can reset any
  other user's password (a key icon next to their row) if they're locked out. New
  staff can also self-register at `/signup` using an invite code from the HR Users
  page, instead of an admin creating the account and sharing a password.
- **Dashboard** — totals for trainings, upcoming, completed, nominees, attendees.
- **Training Management** — create/edit/delete trainings (name, category, date, venue,
  cost, paid/free, per diem, description).
- **Nominees** — add multiple nominees per training with department/division/section/
  station details.
- **Attendance** — mark each nominee Attended / Did Not Attend / Pending. Each nominee
  with a work email gets a shareable self-confirmation link (`confirm.html?token=...`)
  they can use to confirm their own attendance.
- **Evidence Upload** — attach attendance registers, photos, reports, etc. per training
  (images, PDF, Word, Excel, PowerPoint, CSV, or plain text; up to 25MB per file).
- **Reports** — monthly report (nominees/attendees/absentees/cost/paid/per diem per
  training), exportable to Excel (`.xlsx`).
- **Search** — filter trainings by name, category, date, and (nominee) department.

## Notes

- The employee self-confirmation flow verifies the submitted work email against the
  email on file for that nominee — it does not send email itself. Share the generated
  link (via the "Copy Link" button on a training's nominee row) through your existing
  email system. This link intentionally stays public/unauthenticated so employees
  don't need an HR login to confirm their own attendance.
- `node:sqlite` is an experimental Node API; you'll see an `ExperimentalWarning` on
  startup, which is expected and harmless.
- Sessions are stored in a `sessions` table in the same SQLite database (see
  `backend/db/sqliteSessionStore.js`) rather than Express's default in-memory store, so
  staff stay signed in across server restarts. This also means the store is ready to
  share across multiple server processes (e.g. behind a load balancer) later, since
  they'd all read/write the same SQLite file — though for genuine multi-instance
  deployment you'd want a networked store (e.g. Postgres-backed sessions) instead of a
  shared file.
- The session-signing secret and the self-service invite code are generated once and
  persisted in the `settings` table, so they also survive restarts.
- Passwords are hashed with Node's built-in `crypto.scrypt` (salted, no plaintext ever
  stored) — no extra dependency needed.
- The invite code lets anyone who has it create a full HR account, which can see all
  employee training data (names, employee numbers, departments). Only share it with
  people you intend to have access, and regenerate it if it leaks.
- The backend's `frontend/dist` reference is a relative path one level up — keep
  `backend/` and `frontend/` as siblings under the repo root (as they are) for this to
  resolve correctly.
- Where the SQLite file and `uploads/` actually live is controlled by the optional
  `DATA_DIR` env var (see `backend/db/database.js`). Unset (local dev), everything
  stays at `backend/db/hrms.sqlite` and `backend/uploads/` exactly as before. Set (as
  it is in production via `render.yaml`), both move under `$DATA_DIR` instead — e.g.
  `$DATA_DIR/hrms.sqlite` and `$DATA_DIR/uploads/` — so they land on the mounted
  persistent disk rather than the ephemeral container filesystem.
- The frontend uses Tailwind CSS v4 (via `@tailwindcss/vite`, configured in
  `frontend/vite.config.js`) — no separate `tailwind.config.js` needed. Shared visual
  patterns (buttons, cards, form inputs, badges, tables) are defined once as `@apply`
  component classes in `frontend/src/index.css` (e.g. `.btn-primary`, `.card`,
  `.form-input`) rather than repeating long utility strings in every component. The
  Modal, navbar dropdown, and mobile menu are all plain React state — no Bootstrap JS
  or other UI library involved.
