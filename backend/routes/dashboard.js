const express = require('express');
const { Training, Nominee } = require('../db/database');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

router.get('/', asyncHandler(async (req, res) => {

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());

  const [totalTrainings, upcomingTrainings, completedTrainings, totalNominees, totalAttendees, totalDeclined] =
    await Promise.all([
      Training.countDocuments(),
      Training.countDocuments({
        // Updated to snake_case $training_end_date and $training_date
        $expr: { $gte: [{ $ifNull: ['$training_end_date', '$training_date'] }, today] },
      }),
      Training.countDocuments({
        // Updated to snake_case $training_end_date and $training_date
        $expr: { $lt: [{ $ifNull: ['$training_end_date', '$training_date'] }, today] },
      }),
      // Updated to snake_case keys for nomination and attendance status
      Nominee.countDocuments({ nomination_status: { $ne: 'Declined' } }),
      Nominee.countDocuments({ nomination_status: { $ne: 'Declined' }, attendance_status: 'Attended' }),
      Nominee.countDocuments({ nomination_status: 'Declined' }),
    ]);

  res.json({
    totalTrainings,
    upcomingTrainings,
    completedTrainings,
    totalNominees,
    totalAttendees,
    totalDeclined,
  });
}));

module.exports = router;