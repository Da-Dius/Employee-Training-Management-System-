const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const { db, uploadsDir } = require('../db/database');

const router = express.Router();

function trainingStatus(dateStr) {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr >= today ? 'Upcoming' : 'Completed';
}

function serializeTraining(row) {
  return {
    ...row,
    paid: !!row.paid,
    per_diem: !!row.per_diem,
    status: trainingStatus(row.training_date),
  };
}

// GET /api/trainings?name=&category=&date=&department=
router.get('/', (req, res) => {
  const { name, category, date, department } = req.query;

  let sql = 'SELECT * FROM trainings WHERE 1=1';
  const params = [];

  if (name) {
    sql += ' AND name LIKE ?';
    params.push(`%${name}%`);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (date) {
    sql += ' AND training_date = ?';
    params.push(date);
  }
  if (department) {
    sql += ` AND id IN (SELECT training_id FROM nominees WHERE department LIKE ?)`;
    params.push(`%${department}%`);
  }

  sql += ' ORDER BY training_date DESC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(serializeTraining));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM trainings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Training not found' });
  res.json(serializeTraining(row));
});

router.post('/', (req, res) => {
  const { name, category, training_date, venue, cost, paid, per_diem, description } = req.body;

  if (!name || !category || !training_date) {
    return res.status(400).json({ error: 'name, category and training_date are required' });
  }

  const stmt = db.prepare(`
    INSERT INTO trainings (name, category, training_date, venue, cost, paid, per_diem, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    name,
    category,
    training_date,
    venue || null,
    Number(cost) || 0,
    paid ? 1 : 0,
    per_diem ? 1 : 0,
    description || null
  );

  const row = db.prepare('SELECT * FROM trainings WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serializeTraining(row));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM trainings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Training not found' });

  const { name, category, training_date, venue, cost, paid, per_diem, description } = req.body;

  db.prepare(`
    UPDATE trainings SET
      name = ?, category = ?, training_date = ?, venue = ?, cost = ?, paid = ?, per_diem = ?, description = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? existing.name,
    category ?? existing.category,
    training_date ?? existing.training_date,
    venue ?? existing.venue,
    cost !== undefined ? Number(cost) : existing.cost,
    paid !== undefined ? (paid ? 1 : 0) : existing.paid,
    per_diem !== undefined ? (per_diem ? 1 : 0) : existing.per_diem,
    description ?? existing.description,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM trainings WHERE id = ?').get(req.params.id);
  res.json(serializeTraining(row));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM trainings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Training not found' });

  const evidenceFiles = db
    .prepare('SELECT filename FROM evidence WHERE training_id = ?')
    .all(req.params.id);

  db.prepare('DELETE FROM trainings WHERE id = ?').run(req.params.id);

  evidenceFiles.forEach((row) => {
    fs.unlink(path.join(uploadsDir, row.filename), () => {});
  });

  res.status(204).end();
});

module.exports = router;
