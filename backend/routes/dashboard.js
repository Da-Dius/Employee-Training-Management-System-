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
      // Counted against the end date when there is one, matching trainingStatus() in
      // routes/trainings.js — otherwise day two of a multi-day training would show as
      // "Upcoming" on the Trainings page and "Completed" in these KPIs at the same time.
      // The two predicates stay exact complements, so upcoming + completed === total.
      Training.countDocuments({
        $expr: { $gte: [{ $ifNull: ['$trainingEndDate', '$trainingDate'] }, today] },
      }),
      Training.countDocuments({
        $expr: { $lt: [{ $ifNull: ['$trainingEndDate', '$trainingDate'] }, today] },
      }),
      // A decline is a withdrawal, not a no-show, so declined nominees drop out of both
      // the total and the attendee count. Excluding them from only the denominator would
      // let DashboardPage's "% of nominees" exceed 100%.
      //
      // `$ne: 'Declined'` and NOT `$in: ['Pending','Accepted']`: nominees created before
      // nominationStatus existed have no such key at all, and countDocuments reads raw
      // BSON rather than hydrating the schema default. $ne matches a missing path; $in
      // would silently zero out every one of those records.
      Nominee.countDocuments({ nominationStatus: { $ne: 'Declined' } }),
      Nominee.countDocuments({ nominationStatus: { $ne: 'Declined' }, attendanceStatus: 'Attended' }),
      Nominee.countDocuments({ nominationStatus: 'Declined' }),
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