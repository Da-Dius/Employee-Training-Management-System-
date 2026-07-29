const express = require('express');
const { Training, Nominee } = require('../db/database');
const authRateLimiter = require('../middleware/authRateLimiter');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function serializeNominee(doc) {
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

function serializeTraining(doc) {
  if (!doc) return null;
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
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

// GET /api/confirm/:token - lookup nominee + training by confirmation token (public, no auth)
router.get('/:token', asyncHandler(async (req, res) => {
  const nominee = await Nominee.findOne({ confirmationToken: req.params.token });
  if (!nominee) return res.status(404).json({ error: 'Invalid or expired confirmation link' });

  const training = await Training.findById(nominee.training);

  res.json({
    nominee: serializeNominee(nominee),
    training: serializeTraining(training),
  });
}));

// POST /api/confirm/:token - employee confirms attendance using their work email as identity
router.post('/:token', authRateLimiter, asyncHandler(async (req, res) => {
  const nominee = await Nominee.findOne({ confirmationToken: req.params.token });
  if (!nominee) return res.status(404).json({ error: 'Invalid or expired confirmation link' });

  const { work_email } = req.body;
  if (!work_email || !nominee.email || work_email.trim().toLowerCase() !== nominee.email.trim().toLowerCase()) {
    return res.status(400).json({ error: 'Work email does not match our records for this nominee' });
  }

  nominee.employeeConfirmed = true;
  nominee.attendanceStatus = 'Attended';
  await nominee.save();

  res.json(serializeNominee(nominee));
}));

module.exports = router;