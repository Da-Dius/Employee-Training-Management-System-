const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');
const { mongoose, Training, Evidence, uploadsDir } = require('../db/database');

const router = express.Router({ mergeParams: true });

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Keeps the same snake_case JSON shape the frontend already expects.
function serialize(doc) {
  return {
    id: doc._id,
    training_id: doc.training,
    filename: doc.filename,
    original_name: doc.original_name,
    size: doc.size,
    uploaded_at: doc.uploadedAt,
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}${path.extname(file.originalname)}`);
  },
});

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

router.get('/', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId)) return res.json([]);
  const docs = await Evidence.find({ training: req.params.trainingId }).sort({ uploadedAt: -1 });
  res.json(docs.map(serialize));
}));

router.post('/', upload.array('files', 10), asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId)) return res.status(404).json({ error: 'Training not found' });
  const training = await Training.findById(req.params.trainingId).select('_id');
  if (!training) return res.status(404).json({ error: 'Training not found' });

  const files = req.files || [];

  const inserted = await Promise.all(
    files.map((f) =>
      Evidence.create({
        training: req.params.trainingId,
        filename: f.filename,
        original_name: f.originalname, // Fixed to map to snake_case
        size: f.size,
      })
    )
  );

  res.status(201).json(inserted.map(serialize));
}));

router.get('/:evidenceId/download', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.evidenceId)) {
    return res.status(404).json({ error: 'Evidence not found' });
  }
  const doc = await Evidence.findOne({ _id: req.params.evidenceId, training: req.params.trainingId });
  if (!doc) return res.status(404).json({ error: 'Evidence not found' });

  // Fixed to doc.original_name
  res.download(path.join(uploadsDir, doc.filename), doc.original_name);
}));

router.delete('/:evidenceId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.evidenceId)) {
    return res.status(404).json({ error: 'Evidence not found' });
  }
  const doc = await Evidence.findOne({ _id: req.params.evidenceId, training: req.params.trainingId });
  if (!doc) return res.status(404).json({ error: 'Evidence not found' });

  await Evidence.deleteOne({ _id: req.params.evidenceId });
  fs.unlink(path.join(uploadsDir, doc.filename), () => { });
  res.status(204).end();
}));

module.exports = router;