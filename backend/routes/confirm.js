const express = require('express');
const { db } = require('../db/database');
const authRateLimiter = require('../middleware/authRateLimiter');

const router = express.Router();

// GET /api/confirm/:token - lookup nominee + training by confirmation token (public, no auth)
router.get('/:token', (req, res) => {
  const nominee = db
    .prepare('SELECT * FROM nominees WHERE confirmation_token = ?')
    .get(req.params.token);
  if (!nominee) return res.status(404).json({ error: 'Invalid or expired confirmation link' });

  const training = db.prepare('SELECT * FROM trainings WHERE id = ?').get(nominee.training_id);

  res.json({
    nominee: { ...nominee, employee_confirmed: !!nominee.employee_confirmed },
    training,
  });
});

// POST /api/confirm/:token - employee confirms attendance using their work email as identity
router.post('/:token', authRateLimiter, (req, res) => {
  const nominee = db
    .prepare('SELECT * FROM nominees WHERE confirmation_token = ?')
    .get(req.params.token);
  if (!nominee) return res.status(404).json({ error: 'Invalid or expired confirmation link' });

  const { work_email } = req.body;
  if (!work_email || !nominee.email || work_email.trim().toLowerCase() !== nominee.email.trim().toLowerCase()) {
    return res.status(400).json({ error: 'Work email does not match our records for this nominee' });
  }

  db.prepare(`
    UPDATE nominees SET employee_confirmed = 1, attendance_status = 'Attended' WHERE id = ?
  `).run(nominee.id);

  const updated = db.prepare('SELECT * FROM nominees WHERE id = ?').get(nominee.id);
  res.json({ ...updated, employee_confirmed: !!updated.employee_confirmed });
});

module.exports = router;
