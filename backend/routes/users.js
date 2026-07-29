const express = require('express');
const { mongoose, User, hashPassword, getInviteCode, regenerateInviteCode } = require('../db/database');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function serialize(doc) {
  return {
    id: doc._id,
    username: doc.username,
    name: doc.name,
    created_at: doc.createdAt,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const docs = await User.find().sort({ name: 1 });
  res.json(docs.map(serialize));
}));

router.get('/invite-code', asyncHandler(async (req, res) => {
  res.json({ invite_code: await getInviteCode() });
}));

router.post('/invite-code/regenerate', asyncHandler(async (req, res) => {
  res.json({ invite_code: await regenerateInviteCode() });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { username, name, password } = req.body;
  if (!username || !name || !password) {
    return res.status(400).json({ error: 'username, name and password are required' });
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

  res.status(201).json(serialize(user));
}));

router.post('/:id/reset-password', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'User not found' });
  const existing = await User.findById(req.params.id).select('_id');
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  await User.updateOne({ _id: req.params.id }, { passwordHash: hashPassword(new_password) });
  res.status(204).end();
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'User not found' });
  const existing = await User.findById(req.params.id).select('_id');
  if (!existing) return res.status(404).json({ error: 'User not found' });

  if (req.params.id === req.session.userId) {
    return res.status(400).json({ error: 'You cannot remove your own account while signed in' });
  }

  const totalUsers = await User.countDocuments();
  if (totalUsers <= 1) {
    return res.status(400).json({ error: 'At least one HR account must remain' });
  }

  await User.deleteOne({ _id: req.params.id });
  res.status(204).end();
}));

module.exports = router;