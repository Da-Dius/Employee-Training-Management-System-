const express = require('express');
const { mongoose, Training, Nominee, genToken } = require('../db/database');

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
    name: doc.name,
    employee_number: doc.employeeNumber,
    department: doc.department,
    division: doc.division,
    section: doc.section,
    station_region: doc.stationRegion,
    email: doc.email,
    attendance_status: doc.attendanceStatus,
    employee_confirmed: !!doc.employeeConfirmed,
    confirmation_token: doc.confirmationToken,
    created_at: doc.createdAt,
  };
}

// GET /api/trainings/:trainingId/nominees
router.get('/', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId)) return res.json([]);
  const docs = await Nominee.find({ training: req.params.trainingId }).sort({ createdAt: 1 });
  res.json(docs.map(serialize));
}));

router.post('/', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId)) return res.status(404).json({ error: 'Training not found' });
  const training = await Training.findById(req.params.trainingId).select('_id');
  if (!training) return res.status(404).json({ error: 'Training not found' });

  const { name, employee_number, department, division, section, station_region, email } = req.body;
  if (!name || !employee_number) {
    return res.status(400).json({ error: 'name and employee_number are required' });
  }

  const doc = await Nominee.create({
    training: req.params.trainingId,
    name,
    employeeNumber: employee_number,
    department: department || undefined,
    division: division || undefined,
    section: section || undefined,
    stationRegion: station_region || undefined,
    email: email || undefined,
    confirmationToken: genToken(),
  });

  res.status(201).json(serialize(doc));
}));

router.put('/:nomineeId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.nomineeId)) {
    return res.status(404).json({ error: 'Nominee not found' });
  }
  const existing = await Nominee.findOne({ _id: req.params.nomineeId, training: req.params.trainingId });
  if (!existing) return res.status(404).json({ error: 'Nominee not found' });

  const { name, employee_number, department, division, section, station_region, email, attendance_status } = req.body;

  existing.name = name ?? existing.name;
  existing.employeeNumber = employee_number ?? existing.employeeNumber;
  existing.department = department ?? existing.department;
  existing.division = division ?? existing.division;
  existing.section = section ?? existing.section;
  existing.stationRegion = station_region ?? existing.stationRegion;
  existing.email = email ?? existing.email;
  existing.attendanceStatus = attendance_status ?? existing.attendanceStatus;

  await existing.save();

  res.json(serialize(existing));
}));

// PATCH /api/trainings/:trainingId/nominees/:nomineeId/attendance
router.patch('/:nomineeId/attendance', asyncHandler(async (req, res) => {
  const { attendance_status } = req.body;
  if (!['Attended', 'Did Not Attend', 'Pending'].includes(attendance_status)) {
    return res.status(400).json({ error: 'Invalid attendance_status' });
  }

  if (!isValidId(req.params.trainingId) || !isValidId(req.params.nomineeId)) {
    return res.status(404).json({ error: 'Nominee not found' });
  }
  const existing = await Nominee.findOne({ _id: req.params.nomineeId, training: req.params.trainingId });
  if (!existing) return res.status(404).json({ error: 'Nominee not found' });

  existing.attendanceStatus = attendance_status;
  await existing.save();

  res.json(serialize(existing));
}));

router.delete('/:nomineeId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.nomineeId)) {
    return res.status(404).json({ error: 'Nominee not found' });
  }
  const existing = await Nominee.findOne({ _id: req.params.nomineeId, training: req.params.trainingId });
  if (!existing) return res.status(404).json({ error: 'Nominee not found' });

  await Nominee.deleteOne({ _id: req.params.nomineeId });
  res.status(204).end();
}));

module.exports = router;