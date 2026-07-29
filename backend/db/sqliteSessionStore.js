const session = require('express-session');
const { db } = require('./database');

const DEFAULT_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    this.clearExpired();
    this.cleanupTimer = setInterval(() => this.clearExpired(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  clearExpired() {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  }

  get(sid, callback) {
    try {
      const row = db.prepare('SELECT session_json, expires_at FROM sessions WHERE sid = ?').get(sid);
      if (!row || row.expires_at < Date.now()) return callback(null, null);
      callback(null, JSON.parse(row.session_json));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const maxAge = sessionData.cookie?.maxAge ?? DEFAULT_MAX_AGE_MS;
      const expiresAt = Date.now() + maxAge;
      db.prepare(`
        INSERT INTO sessions (sid, session_json, expires_at) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET session_json = excluded.session_json, expires_at = excluded.expires_at
      `).run(sid, JSON.stringify(sessionData), expiresAt);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  touch(sid, sessionData, callback) {
    this.set(sid, sessionData, callback);
  }

  destroy(sid, callback) {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }
}

module.exports = SqliteSessionStore;
