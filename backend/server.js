const express = require('express');
const session = require('express-session');
const path = require('node:path');
const fs = require('node:fs');

const { sessionSecret } = require('./db/database');
const SqliteSessionStore = require('./db/sqliteSessionStore');

const requireAuth = require('./middleware/requireAuth');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const trainingsRouter = require('./routes/trainings');
const nomineesRouter = require('./routes/nominees');
const evidenceRouter = require('./routes/evidence');
const dashboardRouter = require('./routes/dashboard');
const reportsRouter = require('./routes/reports');
const confirmRouter = require('./routes/confirm');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const frontendIndexHtml = path.join(frontendDist, 'index.html');

app.set('trust proxy', 1);

app.use(express.json());

app.use(
  session({
    store: new SqliteSessionStore(),
    secret: process.env.SESSION_SECRET || sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PRODUCTION,
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

// confirm.html — public employee self-confirmation page.
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.static(frontendDist));

// Public routes: login itself, and the employee self-confirmation flow
app.use('/api/auth', authRouter);
app.use('/api/confirm', confirmRouter);

// HR staff session
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/reports', requireAuth, reportsRouter);
app.use('/api/trainings/:trainingId/nominees', requireAuth, nomineesRouter);
app.use('/api/trainings/:trainingId/evidence', requireAuth, evidenceRouter);
app.use('/api/trainings', requireAuth, trainingsRouter);

// Unmatched /api/* requests get a JSON 404 instead of falling through to the SPA fallback below
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// SPA fallback: any other GET request goes to the React app so client-side routing
// (e.g. /trainings/5) works on a hard refresh or direct link.
app.get('*', (req, res) => {
  if (!fs.existsSync(frontendIndexHtml)) {
    return res
      .status(404)
      .send(
        'Frontend build not found. Run `npm run build` in frontend/ for production, ' +
        'or use the Vite dev server (npm run dev in frontend/) during development.'
      );
  }
  res.sendFile(frontendIndexHtml);
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE' || (err.message && err.message.includes('File too large'))) {
    return res.status(413).json({ error: 'File too large (max 25MB)' });
  }
  if (err.message && err.message.startsWith('Unsupported file type')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`HRMS Training Management System running at http://localhost:${PORT}`);
});
