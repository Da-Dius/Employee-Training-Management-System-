const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');
const { db, uploadsDir } = require('../db/database');

const router = express.Router({ mergeParams: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}${path.extname(file.originalname)}`);
  },
});

// Attendance registers, photos, and reports — images, PDFs, and common office documents.
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
]);

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error('Unsupported file type. Allowed: images, PDF, Word, Excel, PowerPoint, CSV, or plain text.'));
}

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter,
});

// GET /api/trainings/:trainingId/evidence
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM evidence WHERE training_id = ? ORDER BY uploaded_at DESC')
    .all(req.params.trainingId);
  res.json(rows);
});

// POST /api/trainings/:trainingId/evidence  (multipart/form-data, field name "files", multiple allowed)
router.post('/', upload.array('files', 10), (req, res) => {
  const training = db.prepare('SELECT id FROM trainings WHERE id = ?').get(req.params.trainingId);
  if (!training) return res.status(404).json({ error: 'Training not found' });

  const files = req.files || [];
  const insert = db.prepare(`
    INSERT INTO evidence (training_id, filename, original_name, size)
    VALUES (?, ?, ?, ?)
  `);

  const inserted = files.map((f) => {
    const info = insert.run(req.params.trainingId, f.filename, f.originalname, f.size);
    return db.prepare('SELECT * FROM evidence WHERE id = ?').get(info.lastInsertRowid);
  });

  res.status(201).json(inserted);
});

// GET /api/trainings/:trainingId/evidence/:evidenceId/download
router.get('/:evidenceId/download', (req, res) => {
  const row = db
    .prepare('SELECT * FROM evidence WHERE id = ? AND training_id = ?')
    .get(req.params.evidenceId, req.params.trainingId);
  if (!row) return res.status(404).json({ error: 'Evidence not found' });

  res.download(path.join(uploadsDir, row.filename), row.original_name);
});

router.delete('/:evidenceId', (req, res) => {
  const row = db
    .prepare('SELECT * FROM evidence WHERE id = ? AND training_id = ?')
    .get(req.params.evidenceId, req.params.trainingId);
  if (!row) return res.status(404).json({ error: 'Evidence not found' });

  db.prepare('DELETE FROM evidence WHERE id = ?').run(req.params.evidenceId);
  fs.unlink(path.join(uploadsDir, row.filename), () => {});
  res.status(204).end();
});

module.exports = router;
