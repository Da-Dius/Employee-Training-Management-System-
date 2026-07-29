const express = require('express');
const { Training, Nominee } = require('../db/database');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

router.get('/', asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const [totalTrainings, upcomingTrainings, completedTrainings, totalNominees, totalAttendees] =
    await Promise.all([
      Training.countDocuments(),
      Training.countDocuments({ trainingDate: { $gte: today } }),
      Training.countDocuments({ trainingDate: { $lt: today } }),
      Nominee.countDocuments(),
      Nominee.countDocuments({ attendanceStatus: 'Attended' }),
    ]);

  res.json({
    totalTrainings,
    upcomingTrainings,
    completedTrainings,
    totalNominees,
    totalAttendees,
  });
}));

module.exports = router;