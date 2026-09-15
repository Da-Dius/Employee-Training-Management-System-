# HRCD Employee Training Management System

Training management for the Human Resources and Career Development department: training schedules and costs, nominees, emailed accept/decline and attendance confirmations, attendance registers, evidence files, and monthly reports with Excel export.

## Tech stack

- **Backend:** Node.js + Express 4
- **Database:** MongoDB (Mongoose 9); uploaded files are stored in MongoDB GridFS
- **Frontend:** React 19 + Vite 8, Tailwind CSS v4, Lucide icons
- **Email:** Nodemailer with a Gmail app password
- **Exports:** ExcelJS

Requires Node.js 20.19+ (or 22.12+) and pnpm.

## Project structure

```text
hrms/
├── backend/
│   ├── server.js             # Express app: API routes, sessions, serves the built frontend
│   ├── mailer.js             # Nomination and attendance emails
│   ├── db/database.js        # MongoDB connection, schemas, models and helpers
│   ├── lib/http.js           # Shared route helpers
│   ├── middleware/           # requireAuth, requireAdmin, rate limiters
│   ├── routes/               # auth, users, trainings, nominees, evidence, reports, ...
│   ├── storage/              # GridFS file storage and upload rules
│   ├── scripts/              # create-user, reset-password, migrate-uploads-to-gridfs
│   └── public/confirm.html   # Employee confirmation page (no login needed)
└── frontend/
    ├── vite.config.js        # Dev server proxy to the backend
    └── src/
        ├── api/client.js     # API calls
        ├── context/          # Signed-in user and toast messages
        ├── components/       # Modals, navigation, pagination, error boundary
        └── routes/           # Pages
```

`confirm.html` is a plain page served by the backend. Nominees open it from the link in their email to accept or decline, and again after the training to confirm whether they attended.

## Environment variables

Create `backend/.env` (it is gitignored):

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `SESSION_SECRET` | Signs session cookies |
| `GMAIL_USER` | Gmail address that sends the emails |
| `GMAIL_APP_PASSWORD` | Gmail app password for that address |
| `APP_BASE_URL` | Public URL of the app, used in email links |
| `NODE_ENV` | `development` locally, `production` when deployed |
| `PORT` | Optional, defaults to 3000 |

## Local development

Run the backend and the frontend in two terminals:

```bash
cd backend
pnpm install
pnpm run dev
```

```bash
cd frontend
pnpm install
pnpm run dev
```

Open http://localhost:5173. Vite forwards `/api` and `/confirm.html` to the backend on port 3000.

## Production

The backend serves the built frontend from `frontend/dist`:

```bash
cd frontend
pnpm install
pnpm run build
cd ../backend
pnpm install
pnpm start
```

Open http://localhost:3000.

### Render

- **Build command:** `cd frontend && pnpm install && pnpm run build && cd ../backend && pnpm install`
- **Start command:** `cd backend && node server.js`
- **Environment:** every variable above, with `NODE_ENV=production`

## First-time setup

The first account created at `/signup` needs no invite code and becomes an admin. You can also create accounts from the command line — run scripts from `backend/` so `.env` is found:

```bash
node scripts/create-user.js <username> <password> <full name> [--admin]
```

Admins share the invite code shown on **HR Users** so colleagues can sign up as staff.

### Emergency password reset

```bash
node scripts/reset-password.js <username> <new-password>
```

This also signs the user out of every existing session.

### Moving older uploads into the database

Files uploaded before storage moved to GridFS were saved in `backend/uploads/`. Copy them across once; it is safe to re-run:

```bash
node scripts/migrate-uploads-to-gridfs.js
```

## Roles

| Action | Staff | Admin |
|---|:---:|:---:|
| Create and edit trainings, nominees and employees; mark attendance; upload evidence; run reports | ✓ | ✓ |
| Remove a nominee from a training | ✓ | ✓ |
| Delete trainings, employees and evidence files | | ✓ |
| Manage departments, HR users and the invite code | | ✓ |

## Features

- **Trainings:** dates, venue, trainer, cost, service entry, per diem, LPO number and attachment.
- **Nominees:** add from the employee directory, or import an `.xlsx` sheet with employee numbers in the first column (header row optional). A nominee who declines can be replaced; their declined record is kept.
- **Confirmations:** nominees accept or decline from an email link, then confirm attendance after the training.
- **Attendance register:** mark attendance from the training's start date, or print the register.
- **Evidence:** attach PDFs, Office files, images, CSV or text files, up to 25 MB each.
- **Reports:** monthly training, attendance and cost figures by category and department, with Excel exports.
