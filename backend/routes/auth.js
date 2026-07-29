const express = require('express');
const { db, verifyPassword, hashPassword, getInviteCode } = require('../db/database');
const authRateLimiter = require('../middleware/authRateLimiter');

const router = express.Router();

router.get('/status', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  res.json({ requiresInviteCode: userCount > 0 });
});

router.post('/signup', authRateLimiter, (req, res) => {
  const { username, name, password, invite_code } = req.body;
  if (!username || !name || !password) {
    return res.status(400).json({ error: 'username, name and password are required' });
  }

  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const isFirstAccount = userCount === 0;

  if (!isFirstAccount) {
    if (!invite_code) {
      return res.status(400).json({ error: 'An invite code is required' });
    }
    if (invite_code.trim().toUpperCase() !== getInviteCode()) {
      return res.status(403).json({ error: 'Invalid invite code' });
    }
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(normalizedUsername);
  if (existing) {
    return res.status(409).json({ error: 'That username is already taken' });
  }

  const info = db
    .prepare('INSERT INTO users (username, name, password_hash) VALUES (?, ?, ?)')
    .run(normalizedUsername, name.trim(), hashPassword(password));

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start session' });
    req.session.userId = info.lastInsertRowid;
    res.status(201).json({ id: info.lastInsertRowid, username: normalizedUsername, name: name.trim() });
  });
});

router.post('/login', authRateLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start session' });
    req.session.userId = user.id;
    res.json({ id: user.id, username: user.username, name: user.name });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  const user = db.prepare('SELECT id, username, name FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  res.json(user);
});

module.exports = router;
