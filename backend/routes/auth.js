const express = require('express');
const { User, verifyPassword, hashPassword, getInviteCode } = require('../db/database');
const authRateLimiter = require('../middleware/authRateLimiter');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

router.get('/status', asyncHandler(async (req, res) => {
  const userCount = await User.countDocuments();
  res.json({ requiresInviteCode: userCount > 0 });
}));

router.post('/signup', authRateLimiter, asyncHandler(async (req, res) => {
  const { username, name, password, invite_code } = req.body;
  if (!username || !name || !password) {
    return res.status(400).json({ error: 'username, name and password are required' });
  }

  const userCount = await User.countDocuments();
  const isFirstAccount = userCount === 0;

  if (!isFirstAccount) {
    if (!invite_code) {
      return res.status(400).json({ error: 'An invite code is required' });
    }
    const currentInviteCode = await getInviteCode();
    if (invite_code.trim().toUpperCase() !== currentInviteCode) {
      return res.status(403).json({ error: 'Invalid invite code' });
    }
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const existing = await User.findOne({ username: normalizedUsername });
  if (existing) {
    return res.status(409).json({ error: 'That username is already taken' });
  }

  const user = await User.create({
    username: normalizedUsername,
    name: name.trim(),
    passwordHash: hashPassword(password),
  });

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start session' });
    req.session.userId = user._id.toString();
    res.status(201).json({ id: user._id, username: user.username, name: user.name });
  });
}));

router.post('/login', authRateLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = await User.findOne({ username: username.trim().toLowerCase() });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start session' });
    req.session.userId = user._id.toString();
    res.json({ id: user._id, username: user.username, name: user.name });
  });
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
});

router.get('/me', asyncHandler(async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  const user = await User.findById(req.session.userId).select('username name');
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  res.json({ id: user._id, username: user.username, name: user.name });
}));

module.exports = router;