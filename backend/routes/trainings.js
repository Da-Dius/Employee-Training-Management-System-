const express = require('express');
const { Training, Nominee, Evidence, Notification, nairobiDateString } = require('../db/database');
const requireAdmin = require('../middleware/requireAdmin');
const { asyncHandler, isValidId, escapeRegex } = require('../lib/http');
const { sendStoredFile, deleteStoredFile } = require('../storage/gridfs');
const { upload } = require('../storage/upload');

const router = express.Router();

function trainingStatus(startDate, endDate) {
  const effectiveEnd = endDate || startDate;
  return effectiveEnd >= nairobiDateString() ? 'Upcoming' : 'Completed';
}

// Multipart form fields arrive as strings, so 'false' must not be treated as true.
function parseBool(value) {
  return value === true || value === 'true';
}

// Status, sorting and the report month filter all compare dates as YYYY-MM-DD strings,
// so anything else (or an impossible date like 2026-02-30) is rejected.
function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isValidCost(value) {
  if (value === undefined || value === '') return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

// Sends an error response, discarding any LPO attachment multer already stored for the request.
function reject(req, res, status, error) {
  if (req.file) deleteStoredFile(req.file.filename);
  return res.status(status).json({ error });
}

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
    has_started: doc.training_date <= nairobiDateString(),
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { name, category, date, department } = req.query;

  const filter = {};
  if (name) filter.name = { $regex: escapeRegex(name), $options: 'i' };
  if (category) filter.category = category;
  if (date) filter.training_date = date;

  if (department) {
    const matches = await Nominee.find({ department: { $regex: escapeRegex(department), $options: 'i' } }).select('training');
    const trainingIds = [...new Set(matches.map((n) => n.training.toString()))];
    filter._id = { $in: trainingIds };
  }

  const trainings = await Training.find(filter).sort({ training_date: -1 });
  res.json(trainings.map(serializeTraining));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ error: 'Program not found' });
  }
  const training = await Training.findById(req.params.id);
  if (!training) return res.status(404).json({ error: 'Program not found' });
  res.json(serializeTraining(training));
}));

router.post('/', upload.single('lpo_attachment'), asyncHandler(async (req, res) => {
  const {
    name, category, training_date, training_end_date, venue, cost, per_diem, description,
    trainer_name, lpo_number, service_entry,
  } = req.body;

  if (!name || !category || !training_date) {
    return reject(req, res, 400, 'Program name, category and start date are required');
  }
  if (!isValidDateString(training_date) || (training_end_date && !isValidDateString(training_end_date))) {
    return reject(req, res, 400, 'Dates must be real dates in YYYY-MM-DD format');
  }
  if (training_end_date && training_end_date < training_date) {
    return reject(req, res, 400, 'End date must be on or after the start date');
  }
  if (!isValidCost(cost)) {
    return reject(req, res, 400, 'Cost must be a number of 0 or more');
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
    per_diem: parseBool(per_diem),
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
  const existing = isValidId(req.params.id) ? await Training.findById(req.params.id) : null;
  if (!existing) return reject(req, res, 404, 'Program not found');

  const {
    name, category, training_date, training_end_date, venue, cost, per_diem, description,
    trainer_name, lpo_number, service_entry,
  } = req.body;

  if ((training_date !== undefined && !isValidDateString(training_date))
    || (training_end_date && !isValidDateString(training_end_date))) {
    return reject(req, res, 400, 'Dates must be real dates in YYYY-MM-DD format');
  }

  const nextStart = training_date ?? existing.training_date;
  const nextEnd = training_end_date !== undefined ? training_end_date : existing.training_end_date;

  if (nextEnd && nextEnd < nextStart) {
    return reject(req, res, 400, 'End date must be on or after the start date');
  }
  if (!isValidCost(cost)) {
    return reject(req, res, 400, 'Cost must be a number of 0 or more');
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
  existing.cost = cost !== undefined ? Number(cost) || 0 : existing.cost;
  existing.per_diem = per_diem !== undefined ? parseBool(per_diem) : existing.per_diem;
  existing.description = description ?? existing.description;
  existing.trainer_name = trainer_name ?? existing.trainer_name;
  existing.lpo_number = lpo_number ?? existing.lpo_number;

  if (service_entry !== undefined) {
    existing.service_entry = service_entry === 'Paid' ? 'Paid' : 'Not Paid';
    existing.paid = existing.service_entry === 'Paid';
  }

  if (req.file) {
    if (existing.lpo_attachment_filename) {
      deleteStoredFile(existing.lpo_attachment_filename);
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
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ error: 'Program not found' });
  }
  const training = await Training.findById(req.params.id);
  if (!training || !training.lpo_attachment_filename) {
    return res.status(404).json({ error: 'No LPO attachment on file' });
  }
  await sendStoredFile(res, training.lpo_attachment_filename, training.lpo_attachment_original_name);
}));

// Deleting a training also removes its nominees, attendance and files, so it is admin-only.
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ error: 'Program not found' });
  }
  const existing = await Training.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Program not found' });

  const evidenceFiles = await Evidence.find({ training: existing._id }).select('filename');

  if (existing.lpo_attachment_filename) {
    deleteStoredFile(existing.lpo_attachment_filename);
  }

  await Training.deleteOne({ _id: existing._id });

  const nomineeIds = (await Nominee.find({ training: existing._id }).select('_id')).map((n) => n._id);

  await Nominee.deleteMany({ training: existing._id });
  await Evidence.deleteMany({ training: existing._id });
  await Notification.deleteOne({ type: 'training_starting', refId: existing._id });
  await Notification.deleteMany({ type: 'nominee_declined', refId: { $in: nomineeIds } });

  evidenceFiles.forEach((row) => {
    deleteStoredFile(row.filename);
  });

  res.status(204).end();
}));

module.exports = router;
