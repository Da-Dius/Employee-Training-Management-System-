# HRCD Employee Training Management System

A comprehensive training management system for the Human Resources and Career Development department. This platform facilitates training scheduling, nominee tracking, automated attendance confirmations, and financial reporting.

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** MongoDB (via Mongoose)
- **Frontend:** React + Vite, styled with Tailwind CSS v4 (Lucide React for icons)
- **File Uploads:** Multer (stored under `backend/uploads/`)
- **Exports:** ExcelJS for spreadsheet generation

## Project Structure

```text
hrms/
├── backend/
│   ├── server.js                  # Express app entry point & static file server
│   ├── db/
│   │   └── database.js            # MongoDB connection and schema configurations
│   ├── middleware/
│   │   └── requireAuth.js         # Session-check middleware for HR-only API routes
│   ├── routes/                    # API resources (auth, users, trainings, nominees, etc.)
│   ├── scripts/
│   │   ├── create-user.js         # CLI to bootstrap the first HR admin login
│   │   └── reset-password.js      # CLI to manually reset an HR user's password
│   ├── public/
│   │   └── confirm.html           # Unauthenticated portal for employee confirmations
│   └── uploads/                   # Local storage for evidence files and LPO attachments
└── frontend/
    ├── vite.config.js             # Dev-server proxy configuration
    └── src/
        ├── main.jsx, App.jsx      # React entry point and routing
        ├── api/client.js          # Fetch wrappers for the backend API
        ├── context/               # AuthContext (session state) and ToastContext
        ├── components/            # Reusable UI (NavBar, Modals, Forms)
        └── routes/                # Main pages (Dashboard, Trainings, Reports, Users)


`confirm.html` is a plain static HTML page (not part of the React app) that employees
open via a link to confirm their own training attendance, without needing an HR login.
It's served by the backend directly, at the same path in both dev and production.
``` 
## Running it - 
 
### Local Development

The development environment runs the backend and frontend on separate ports, using Vite to proxy API requests.

# Terminal 1 - Start the Backend API (Port 3000)
cd backend
pnpm install
pnpm run dev

# Terminal 2 - Start the React App (Port 5173)
cd frontend
pnpm install
pnpm run dev

Access the application at http://localhost:5173.

```


 ``` 
### Production Deployment 

In production, the Node.js backend directly serves the compiled React static files.

# 1. Build the frontend
cd frontend
npm install
npm run build

# 2. Start the backend server
cd ../backend
npm install
npm start

Access the application at http://localhost:3000.

```

```
### First-time setup: 

Administrative CLI Scripts:

- There is no public sign-up for the very first account. You must bootstrap the initial Admin account via the CLI. Ensure your MONGODB_URI is set in your .env file first.

Create the first Admin user:

```bash
cd backend
node scripts/create-user.js <username> <password> <full name> [--admin]

```
Example:

```bash
node scripts/create-user.js maurice "MyStrongPass1" Maurice Admin
```

### Emergency Password Reset:
If all admins are locked out, you can force a password reset via the CLI:

- cd backend
```bash
node scripts/reset-password.js <username> <new-password>
```

### Core Features
Role-Based Authentication: HR staff utilize cookie-based sessions. Admins can manage staff accounts and generate self-service invite codes for new HR team members.

Training & Nominee Management: Track training schedules, venues, and associated costs. Assign employees to trainings and track their departmental affiliations.

Automated Employee Confirmations: Nominees receive a link (confirm.html?token=...) allowing them to accept or decline attendance without requiring an HR login.

Attendance Workflows: Post-training, HR can trigger automated emails asking accepted nominees to verify their attendance, or manually mark attendance via the register.

Dynamic Replacements: When a nominee declines, HR can seamlessly swap them with a replacement. The original declination is retained for audit purposes.

Evidence Management: Attach compliance documents, LPOs, and post-training evidence (PDF, Excel, images) up to 25MB per file.

Financial & Participation Reporting: Generate real-time analytics on attendance rates, departmental participation, and cost-per-attendee. Export to Excel.