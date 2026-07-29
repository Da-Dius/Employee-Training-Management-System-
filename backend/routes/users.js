const express = require('express');
const { db, hashPassword, getInviteCode, regenerateInviteCode } = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, username, name, created_at FROM users ORDER BY name').all();
  res.json(rows);
});

router.get('/invite-code', (req, res) => {
  res.json({ invite_code: getInviteCode() });
});

router.post('/invite-code/regenerate', (req, res) => {
  res.json({ invite_code: regenerateInviteCode() });
});

router.post('/', (req, res) => {
  const { username, name, password } = req.body;
  if (!username || !name || !password) {
    return res.status(400).json({ error: 'username, name and password are required' });
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

  const user = db.prepare('SELECT id, username, name, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(user);
});

router.post('/:id/reset-password', (req, res) => {
  const targetId = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), targetId);
  res.status(204).end();
});

router.delete('/:id', (req, res) => {
  const targetId = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  if (targetId === req.session.userId) {
    return res.status(400).json({ error: 'You cannot remove your own account while signed in' });
  }

  const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (totalUsers <= 1) {
    return res.status(400).json({ error: 'At least one HR account must remain' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.status(204).end();
});

module.exports = router;
