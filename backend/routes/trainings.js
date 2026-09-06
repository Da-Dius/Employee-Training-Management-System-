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
  // A multi-day training isn't done until its last day passes. With no end date the
  // effective end is the start date, which is the previous single-date behaviour exactly.
  const effectiveEnd = endDate || startDate;
  return effectiveEnd >= today ? 'Upcoming' : 'Completed';
}

// Same multer setup as routes/evidence.js — same disk destination, same allowed types,
// same error-message convention the global handler in server.js already recognizes
// (LIMIT_FILE_SIZE -> 413, "Unsupported file type" prefix -> 400).
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
    id: doc._id,
    name: doc.name,
    category: doc.category,
    training_date: doc.trainingDate,
    // null (not undefined) so the wire shape is identical for old records that never
    // had the field and new ones that were saved with it blank.
    training_end_date: doc.trainingEndDate || null,
    venue: doc.venue,
    cost: doc.cost,
    paid: !!doc.paid, // TODO: remove once TrainingsPage/TrainingDetailPage/ReportsPage are migrated to service_entry
    per_diem: !!doc.perDiem,
    description: doc.description,
    trainer_name: doc.trainerName,
    lpo_number: doc.lpoNumber,
    lpo_attachment_name: doc.lpoAttachmentOriginalName || null,
    service_entry: doc.serviceEntry || 'Not Paid',
    status: trainingStatus(doc.trainingDate, doc.trainingEndDate),
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}


router.get('/', asyncHandler(async (req, res) => {
  const { name, category, date, department } = req.query;

  const filter = {};
  if (name) filter.name = { $regex: name, $options: 'i' };
  if (category) filter.category = category;
  if (date) filter.trainingDate = date;

  if (department) {

    const matches = await Nominee.find({ department: { $regex: department, $options: 'i' } }).select('training');
    const trainingIds = [...new Set(matches.map((n) => n.training.toString()))];
    filter._id = { $in: trainingIds };
  }

  const trainings = await Training.find(filter).sort({ trainingDate: -1 });
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

// POST /api/trainings  (multipart/form-data — same convention as evidence upload;
// the LPO attachment is optional, so a request with no file still works fine, multer
// just leaves req.file undefined and all the text fields land in req.body as before)
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

  // paid is derived from serviceEntry now that the form no longer has its own
  // checkbox for it — keeps existing Paid/Free badges elsewhere working unchanged.
  const resolvedServiceEntry = service_entry === 'Paid' ? 'Paid' : 'Not Paid';

  const training = await Training.create({
    name,
    category,
    trainingDate: training_date,
    // `|| undefined` (same idiom as venue below): multipart sends an untouched date
    // input as '', and storing that would defeat every `endDate || startDate` fallback.
    trainingEndDate: training_end_date || undefined,
    venue: venue || undefined,
    cost: Number(cost) || 0,
    paid: resolvedServiceEntry === 'Paid',
    perDiem: !!per_diem,
    description: description || undefined,
    trainerName: trainer_name || undefined,
    lpoNumber: lpo_number || undefined,
    serviceEntry: resolvedServiceEntry,
    lpoAttachmentFilename: req.file ? req.file.filename : undefined,
    lpoAttachmentOriginalName: req.file ? req.file.originalname : undefined,
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

  // Validate the document as it *will* be, not just what was submitted — otherwise an
  // edit that moves only the start date past an already-stored end date slips through.
  const nextStart = training_date ?? existing.trainingDate;
  const nextEnd = training_end_date !== undefined ? training_end_date : existing.trainingEndDate;
  if (nextEnd && nextEnd < nextStart) {
    return res.status(400).json({ error: 'End date must be on or after the training date' });
  }

  // Start date only, on purpose: the 'training_starting' notification is generated from
  // trainingDate alone and its message says "starts today/tomorrow", so an end-date edit
  // doesn't make it stale — and regenerating would resurrect an already-read notification.
  const dateChanged = training_date !== undefined && training_date !== existing.trainingDate;

  existing.name = name ?? existing.name;
  existing.category = category ?? existing.category;
  existing.trainingDate = training_date ?? existing.trainingDate;
  // Not the `??` idiom used by its neighbours: this field is optional and must stay
  // clearable, so a blank submitted value has to unset it rather than fall through to
  // the old value. Assigning undefined makes Mongoose $unset the path on save.
  if (training_end_date !== undefined) {
    existing.trainingEndDate = training_end_date || undefined;
  }
  existing.venue = venue ?? existing.venue;
  existing.cost = cost !== undefined ? Number(cost) : existing.cost;
  existing.paid = paid !== undefined ? !!paid : existing.paid;
  existing.perDiem = per_diem !== undefined ? !!per_diem : existing.perDiem;
  existing.description = description ?? existing.description;
  existing.trainerName = trainer_name ?? existing.trainerName;
  existing.lpoNumber = lpo_number ?? existing.lpoNumber;
  if (service_entry !== undefined) {
    existing.serviceEntry = service_entry === 'Paid' ? 'Paid' : 'Not Paid';
    existing.paid = existing.serviceEntry === 'Paid';
  }

  // Replacing an LPO attachment: delete the old file from disk before pointing at the new one.
  if (req.file) {
    if (existing.lpoAttachmentFilename) {
      fs.unlink(path.join(uploadsDir, existing.lpoAttachmentFilename), () => { });
    }
    existing.lpoAttachmentFilename = req.file.filename;
    existing.lpoAttachmentOriginalName = req.file.originalname;
  }

  await existing.save();

  if (dateChanged) {
    // The training was rescheduled — any existing "starts today/tomorrow" notification
    // now has a stale date baked into its message. Delete it so the next notifications
    // sync (see routes/notifications.js) regenerates it fresh against the new date,
    // instead of leaving an outdated reminder sitting in everyone's notification list.
    await Notification.deleteOne({ type: 'training_starting', refId: existing._id });
  }

  res.json(serializeTraining(existing));
}));

// GET /api/trainings/:id/lpo-attachment/download
router.get('/:id/lpo-attachment/download', asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: 'Training not found' });
  }
  const training = await Training.findById(req.params.id);
  if (!training || !training.lpoAttachmentFilename) {
    return res.status(404).json({ error: 'No LPO attachment on file' });
  }
  res.download(path.join(uploadsDir, training.lpoAttachmentFilename), training.lpoAttachmentOriginalName);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: 'Training not found' });
  }
  const existing = await Training.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Training not found' });

  const evidenceFiles = await Evidence.find({ training: existing._id }).select('filename');

  if (existing.lpoAttachmentFilename) {
    fs.unlink(path.join(uploadsDir, existing.lpoAttachmentFilename), () => { });
  }

  await Training.deleteOne({ _id: existing._id });
  // Collected before the delete: decline notifications are keyed on the NOMINEE id, so
  // once the rows are gone there is no way to find the notifications that point at them,
  // and they'd linger in the bell linking to a training that no longer exists.
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