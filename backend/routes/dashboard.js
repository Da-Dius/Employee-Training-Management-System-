const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const totalTrainings = db.prepare('SELECT COUNT(*) AS c FROM trainings').get().c;
  const upcomingTrainings = db
    .prepare('SELECT COUNT(*) AS c FROM trainings WHERE training_date >= ?')
    .get(today).c;
  const completedTrainings = db
    .prepare('SELECT COUNT(*) AS c FROM trainings WHERE training_date < ?')
    .get(today).c;
  const totalNominees = db.prepare('SELECT COUNT(*) AS c FROM nominees').get().c;
  const totalAttendees = db
    .prepare("SELECT COUNT(*) AS c FROM nominees WHERE attendance_status = 'Attended'")
    .get().c;

  res.json({
    totalTrainings,
    upcomingTrainings,
    completedTrainings,
    totalNominees,
    totalAttendees,
  });
});

module.exports = router;
