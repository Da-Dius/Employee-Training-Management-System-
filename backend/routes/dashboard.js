const express = require('express');
const { Training, Nominee, nairobiDateString } = require('../db/database');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const today = nairobiDateString();
  // Same rule as a training's status: upcoming until its end date (or single day) has passed
  const effectiveEnd = { $ifNull: ['$training_end_date', '$training_date'] };

  const [totalTrainings, upcomingTrainings, completedTrainings, totalNominees, totalAttendees, totalDeclined] =
    await Promise.all([
      Training.countDocuments(),
      Training.countDocuments({ $expr: { $gte: [effectiveEnd, today] } }),
      Training.countDocuments({ $expr: { $lt: [effectiveEnd, today] } }),
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
