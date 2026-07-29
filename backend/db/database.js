const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

// DATA_DIR points at a persistent disk mount in production (e.g. on Render). Left unset,
// everything stays right where it's always been for local dev — no behavior change.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null;
const dbPath = DATA_DIR ? path.join(DATA_DIR, 'hrms.sqlite') : path.join(__dirname, 'hrms.sqlite');
const uploadsDir = DATA_DIR ? path.join(DATA_DIR, 'uploads') : path.join(__dirname, '..', 'uploads');

if (DATA_DIR) fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS trainings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    training_date TEXT NOT NULL,
    venue TEXT,
    cost REAL NOT NULL DEFAULT 0,
    paid INTEGER NOT NULL DEFAULT 0,
    per_diem INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS nominees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    employee_number TEXT NOT NULL,
    department TEXT,
    division TEXT,
    section TEXT,
    station_region TEXT,
    email TEXT,
    attendance_status TEXT NOT NULL DEFAULT 'Pending',
    employee_confirmed INTEGER NOT NULL DEFAULT 0,
    confirmation_token TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size INTEGER,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    session_json TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_nominees_training ON nominees(training_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_training ON evidence(training_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

function genToken() {
  return crypto.randomBytes(16).toString('hex');
}

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

function getOrCreateSetting(key, factory) {
  const existing = getSetting(key);
  if (existing !== undefined) return existing;
  const value = factory();
  setSetting(key, value);
  return value;
}

const sessionSecret = getOrCreateSetting('session_secret', () => crypto.randomBytes(32).toString('hex'));

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid ambiguity

function generateInviteCode() {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < bytes.length; i++) {
    code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

function getInviteCode() {
  return getOrCreateSetting('invite_code', generateInviteCode);
}

function regenerateInviteCode() {
  const code = generateInviteCode();
  setSetting('invite_code', code);
  return code;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

module.exports = {
  db,
  uploadsDir,
  genToken,
  hashPassword,
  verifyPassword,
  sessionSecret,
  getInviteCode,
  regenerateInviteCode,
};
