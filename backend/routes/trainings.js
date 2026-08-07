const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const { mongoose, Training, Nominee, Evidence, Notification, uploadsDir } = require('../db/database');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function trainingStatus(dateStr) {
  // Compute "today" in the org's local timezone, not the server host's timezone
  // (which is UTC on Render). Using toISOString() here caused trainings to briefly
  // show as "Upcoming" instead of "Completed" during the first few hours after
  // midnight Nairobi time, since the UTC date still lagged a day behind.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
  return dateStr >= today ? 'Upcoming' : 'Completed';
}


function serializeTraining(doc) {
  return {
    id: doc._id,
    name: doc.name,
    category: doc.category,
    training_date: doc.trainingDate,
    venue: doc.venue,
    cost: doc.cost,
    paid: !!doc.paid,
    per_diem: !!doc.perDiem,
    description: doc.description,
    status: trainingStatus(doc.trainingDate),
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

router.post('/', asyncHandler(async (req, res) => {
  const { name, category, training_date, venue, cost, paid, per_diem, description } = req.body;

  if (!name || !category || !training_date) {
    return res.status(400).json({ error: 'name, category and training_date are required' });
  }

  const training = await Training.create({
    name,
    category,
    trainingDate: training_date,
    venue: venue || undefined,
    cost: Number(cost) || 0,
    paid: !!paid,
    perDiem: !!per_diem,
    description: description || undefined,
  });

  res.status(201).json(serializeTraining(training));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: 'Training not found' });
  }
  const existing = await Training.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Training not found' });

  const { name, category, training_date, venue, cost, paid, per_diem, description } = req.body;

  const dateChanged = training_date !== undefined && training_date !== existing.trainingDate;

  existing.name = name ?? existing.name;
  existing.category = category ?? existing.category;
  existing.trainingDate = training_date ?? existing.trainingDate;
  existing.venue = venue ?? existing.venue;
  existing.cost = cost !== undefined ? Number(cost) : existing.cost;
  existing.paid = paid !== undefined ? !!paid : existing.paid;
  existing.perDiem = per_diem !== undefined ? !!per_diem : existing.perDiem;
  existing.description = description ?? existing.description;

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

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ error: 'Training not found' });
  }
  const existing = await Training.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Training not found' });

  const evidenceFiles = await Evidence.find({ training: existing._id }).select('filename');


  await Training.deleteOne({ _id: existing._id });
  await Nominee.deleteMany({ training: existing._id });
  await Evidence.deleteMany({ training: existing._id });
  await Notification.deleteOne({ type: 'training_starting', refId: existing._id });

  evidenceFiles.forEach((row) => {
    fs.unlink(path.join(uploadsDir, row.filename), () => { });
  });

  res.status(204).end();
}));

module.exports = router;