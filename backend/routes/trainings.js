const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');
const { mongoose, Training, Nominee, Evidence, Notification, uploadsDir } = require('../db/database');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function trainingStatus(startDate, endDate) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
  const effectiveEnd = endDate || startDate;
  return effectiveEnd >= today ? 'Upcoming' : 'Completed';
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

function serializeTraining(doc) {
  return {
    id: doc.id, // Comes from our global virtual 'id' in database.js
    name: doc.name,
    category: doc.category,
    training_date: doc.training_date,
    training_end_date: doc.training_end_date || '',
    venue: doc.venue,
    cost: doc.cost,
    paid: !!doc.paid,
    per_diem: !!doc.per_diem,
    description: doc.description,
    trainer_name: doc.trainer_name,
    lpo_number: doc.lpo_number,
    lpo_attachment_name: doc.lpo_attachment_original_name || null,
    service_entry: doc.service_entry || 'Not Paid',
    status: trainingStatus(doc.training_date, doc.training_end_date),
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { name, category, date, department } = req.query;

  const filter = {};
  if (name) filter.name = { $regex: name, $options: 'i' };
  if (category) filter.category = category;
  if (date) filter.training_date = date;

  if (department) {
    const matches = await Nominee.find({ department: { $regex: department, $options: 'i' } }).select('training');
    const trainingIds = [...new Set(matches.map((n) => n.training.toString()))];
    filter._id = { $in: trainingIds };
  }

  const trainings = await Training.find(filter).sort({ training_date: -1 });
  res.json(trainings.map(serializeTraining));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: 'Training not found' });
  }
  const training = await Training.findById(req.params.id);
  if (!training) return res.status(404).json({ error: 'Training not found' });
  res.json(serializeTraining(training));
}));

router.post('/', upload.single('lpo_attachment'), asyncHandler(async (req, res) => {
  const {
    name, category, training_date, training_end_date, venue, cost, paid, per_diem, description,
    trainer_name, lpo_number, service_entry,
  } = req.body;

  if (!name || !category || !training_date) {
    return res.status(400).json({ error: 'name, category and training_date are required' });
  }

  if (training_end_date && training_end_date < training_date) {
    return res.status(400).json({ error: 'End date must be on or after the training date' });
  }

  const resolvedServiceEntry = service_entry === 'Paid' ? 'Paid' : 'Not Paid';

  const training = await Training.create({
    name,
    category,
    training_date,
    training_end_date: training_end_date || undefined,
    venue: venue || undefined,
    cost: Number(cost) || 0,
    paid: resolvedServiceEntry === 'Paid',
    per_diem: !!per_diem,
    description: description || undefined,
    trainer_name: trainer_name || undefined,
    lpo_number: lpo_number || undefined,
    service_entry: resolvedServiceEntry,
    lpo_attachment_filename: req.file ? req.file.filename : undefined,
    lpo_attachment_original_name: req.file ? req.file.originalname : undefined,
  });

  res.status(201).json(serializeTraining(training));
}));

router.put('/:id', upload.single('lpo_attachment'), asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: 'Training not found' });
  }
  const existing = await Training.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Training not found' });

  const {
    name, category, training_date, training_end_date, venue, cost, paid, per_diem, description,
    trainer_name, lpo_number, service_entry,
  } = req.body;

  const nextStart = training_date ?? existing.training_date;
  const nextEnd = training_end_date !== undefined ? training_end_date : existing.training_end_date;

  if (nextEnd && nextEnd < nextStart) {
    return res.status(400).json({ error: 'End date must be on or after the training date' });
  }

  const dateChanged = training_date !== undefined && training_date !== existing.training_date;

  existing.name = name ?? existing.name;
  existing.category = category ?? existing.category;
  existing.training_date = training_date ?? existing.training_date;

  // Handling the clearing of an end date
  if (training_end_date !== undefined) {
    existing.training_end_date = training_end_date || undefined;
  }

  existing.venue = venue ?? existing.venue;
  existing.cost = cost !== undefined ? Number(cost) : existing.cost;
  existing.per_diem = per_diem !== undefined ? !!per_diem : existing.per_diem;
  existing.description = description ?? existing.description;
  existing.trainer_name = trainer_name ?? existing.trainer_name;
  existing.lpo_number = lpo_number ?? existing.lpo_number;

  if (service_entry !== undefined) {
    existing.service_entry = service_entry === 'Paid' ? 'Paid' : 'Not Paid';
    existing.paid = existing.service_entry === 'Paid';
  }

  if (req.file) {
    if (existing.lpo_attachment_filename) {
      fs.unlink(path.join(uploadsDir, existing.lpo_attachment_filename), () => { });
    }
    existing.lpo_attachment_filename = req.file.filename;
    existing.lpo_attachment_original_name = req.file.originalname;
  }

  await existing.save();

  if (dateChanged) {
    await Notification.deleteOne({ type: 'training_starting', refId: existing._id });
  }

  res.json(serializeTraining(existing));
}));

router.get('/:id/lpo-attachment/download', asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: 'Training not found' });
  }
  const training = await Training.findById(req.params.id);
  if (!training || !training.lpo_attachment_filename) {
    return res.status(404).json({ error: 'No LPO attachment on file' });
  }
  res.download(path.join(uploadsDir, training.lpo_attachment_filename), training.lpo_attachment_original_name);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: 'Training not found' });
  }
  const existing = await Training.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Training not found' });

  const evidenceFiles = await Evidence.find({ training: existing._id }).select('filename');

  if (existing.lpo_attachment_filename) {
    fs.unlink(path.join(uploadsDir, existing.lpo_attachment_filename), () => { });
  }

  await Training.deleteOne({ _id: existing._id });

  const nomineeIds = (await Nominee.find({ training: existing._id }).select('_id')).map((n) => n._id);

  await Nominee.deleteMany({ training: existing._id });
  await Evidence.deleteMany({ training: existing._id });
  await Notification.deleteOne({ type: 'training_starting', refId: existing._id });
  await Notification.deleteMany({ type: 'nominee_declined', refId: { $in: nomineeIds } });

  evidenceFiles.forEach((row) => {
    fs.unlink(path.join(uploadsDir, row.filename), () => { });
  });

  res.status(204).end();
}));

module.exports = router;