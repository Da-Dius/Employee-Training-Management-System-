require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { MongoStore } = require('connect-mongo');

const path = require('node:path');
const fs = require('node:fs');

const { mongoose, initSessionSecret } = require('./db/database');

const requireAuth = require('./middleware/requireAuth');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const trainingsRouter = require('./routes/trainings');
const nomineesRouter = require('./routes/nominees');
const evidenceRouter = require('./routes/evidence');
const dashboardRouter = require('./routes/dashboard');
const reportsRouter = require('./routes/reports');
const confirmRouter = require('./routes/confirm');
const employeesRouter = require('./routes/employees');
const notificationsRouter = require('./routes/notifications');
const departmentsRouter = require('./routes/departments');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const frontendIndexHtml = path.join(frontendDist, 'index.html');

app.set('trust proxy', 1);

// Security headers. helmet's default Content-Security-Policy only runs scripts served by this
// app (which is why confirm.html's logic lives in public/confirm.js) and allows styles and
// fonts over https, which covers the Bootstrap CDN the confirmation page uses.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // Forcing https for every request would break plain-http local development
        upgradeInsecureRequests: IS_PRODUCTION ? [] : null,
      },
    },
  })
);

// 'simple' reads ?category[$ne]=x as a plain key, so query values can't become MongoDB operators
app.set('query parser', 'simple');
app.use(express.json());

// Health check for Render (and uptime monitors): 200 only when the database answers.
// Registered before sessions and auth so checks stay cheap and never need a login.
app.get('/api/health', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('Database not connected');
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

async function main() {
  // Wait for the connection itself (up to the driver's 30s server selection timeout) rather than
  // letting the first query fail after Mongoose's 10s buffer on a slow network.
  await mongoose.connection.asPromise();
  const sessionSecret = await initSessionSecret();

  app.use(
    session({
      store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 8 * 60 * 60,
      }),
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

  // confirm.html and confirm.js
  app.use(express.static(path.join(__dirname, 'public')));

  app.use(express.static(frontendDist));

  // Public routes
  app.use('/api/auth', authRouter);
  app.use('/api/confirm', confirmRouter);

  // HR staff session
  app.use('/api/users', requireAuth, usersRouter);
  app.use('/api/employees', requireAuth, employeesRouter);
  app.use('/api/dashboard', requireAuth, dashboardRouter);
  app.use('/api/reports', requireAuth, reportsRouter);
  app.use('/api/trainings/:trainingId/nominees', requireAuth, nomineesRouter);
  app.use('/api/trainings/:trainingId/evidence', requireAuth, evidenceRouter);
  app.use('/api/trainings', requireAuth, trainingsRouter);
  app.use('/api/notifications', requireAuth, notificationsRouter);
  app.use('/api/departments', requireAuth, departmentsRouter);


  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });


  app.get('*', (req, res) => {
    if (!fs.existsSync(frontendIndexHtml)) {
      return res
        .status(404)
        .send(
          'Frontend build not found. Run `pnpm run build` in frontend/ for production, ' +
          'or use the Vite dev server (pnpm run dev in frontend/) during development.'
        );
    }
    res.sendFile(frontendIndexHtml);
  });

  app.use((err, req, res, next) => {
    console.error(err);
    // e.g. a file download interrupted mid-stream: the response is already under way
    if (res.headersSent) return next(err);
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
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
