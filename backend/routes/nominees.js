const express = require('express');
const { db, genToken } = require('../db/database');

const router = express.Router({ mergeParams: true });

function serialize(row) {
  return { ...row, employee_confirmed: !!row.employee_confirmed };
}

// GET /api/trainings/:trainingId/nominees
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM nominees WHERE training_id = ? ORDER BY id')
    .all(req.params.trainingId);
  res.json(rows.map(serialize));
});

router.post('/', (req, res) => {
  const training = db.prepare('SELECT id FROM trainings WHERE id = ?').get(req.params.trainingId);
  if (!training) return res.status(404).json({ error: 'Training not found' });

  const { name, employee_number, department, division, section, station_region, email } = req.body;
  if (!name || !employee_number) {
    return res.status(400).json({ error: 'name and employee_number are required' });
  }

  const token = genToken();
  const info = db
    .prepare(`
      INSERT INTO nominees
        (training_id, name, employee_number, department, division, section, station_region, email, confirmation_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      req.params.trainingId,
      name,
      employee_number,
      department || null,
      division || null,
      section || null,
      station_region || null,
      email || null,
      token
    );

  const row = db.prepare('SELECT * FROM nominees WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serialize(row));
});

router.put('/:nomineeId', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM nominees WHERE id = ? AND training_id = ?')
    .get(req.params.nomineeId, req.params.trainingId);
  if (!existing) return res.status(404).json({ error: 'Nominee not found' });

  const { name, employee_number, department, division, section, station_region, email, attendance_status } = req.body;

  db.prepare(`
    UPDATE nominees SET
      name = ?, employee_number = ?, department = ?, division = ?, section = ?, station_region = ?, email = ?,
      attendance_status = ?
    WHERE id = ?
  `).run(
    name ?? existing.name,
    employee_number ?? existing.employee_number,
    department ?? existing.department,
    division ?? existing.division,
    section ?? existing.section,
    station_region ?? existing.station_region,
    email ?? existing.email,
    attendance_status ?? existing.attendance_status,
    req.params.nomineeId
  );

  const row = db.prepare('SELECT * FROM nominees WHERE id = ?').get(req.params.nomineeId);
  res.json(serialize(row));
});

// PATCH /api/trainings/:trainingId/nominees/:nomineeId/attendance
router.patch('/:nomineeId/attendance', (req, res) => {
  const { attendance_status } = req.body;
  if (!['Attended', 'Did Not Attend', 'Pending'].includes(attendance_status)) {
    return res.status(400).json({ error: 'Invalid attendance_status' });
  }

  const existing = db
    .prepare('SELECT * FROM nominees WHERE id = ? AND training_id = ?')
    .get(req.params.nomineeId, req.params.trainingId);
  if (!existing) return res.status(404).json({ error: 'Nominee not found' });

  db.prepare('UPDATE nominees SET attendance_status = ? WHERE id = ?').run(
    attendance_status,
    req.params.nomineeId
  );

  const row = db.prepare('SELECT * FROM nominees WHERE id = ?').get(req.params.nomineeId);
  res.json(serialize(row));
});

router.delete('/:nomineeId', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM nominees WHERE id = ? AND training_id = ?')
    .get(req.params.nomineeId, req.params.trainingId);
  if (!existing) return res.status(404).json({ error: 'Nominee not found' });

  db.prepare('DELETE FROM nominees WHERE id = ?').run(req.params.nomineeId);
  res.status(204).end();
});

module.exports = router;
