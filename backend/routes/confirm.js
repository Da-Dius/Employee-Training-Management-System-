const express = require('express');
const { Training, Nominee, Notification, hasTrainingEnded } = require('../db/database');
const confirmRateLimiter = require('../middleware/confirmRateLimiter');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function serializeNominee(doc) {
  return {
    id: doc._id,
    training_id: doc.training,
    name: doc.name,
    employee_number: doc.employee_number,
    department: doc.department,
    division: doc.division,
    section: doc.section,
    station_region: doc.station_region,
    email: doc.email,
    nomination_status: doc.nomination_status || 'Pending',
    nomination_responded_at: doc.nomination_responded_at || null,
    decline_reason: doc.decline_reason || null,
    attendance_status: doc.attendance_status,
    attendance_self_reported: !!doc.attendance_self_reported,
    confirmation_token: doc.confirmation_token,
    created_at: doc.createdAt,
  };
}

function serializeTraining(doc) {
  if (!doc) return null;
  return {
    id: doc._id,
    name: doc.name,
    category: doc.category,
    training_date: doc.training_date,
    training_end_date: doc.training_end_date || null,
    venue: doc.venue,
    cost: doc.cost,
    paid: !!doc.paid,
    per_diem: !!doc.per_diem,
    description: doc.description,
    has_ended: hasTrainingEnded(doc.training_date, doc.training_end_date),
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

async function recordDeclineNotification(nominee, training) {
  try {
    await Notification.updateOne(
      { type: 'nominee_declined', refId: nominee._id },
      {
        $setOnInsert: {
          type: 'nominee_declined',
          refId: nominee._id,
          message: `${nominee.name} declined the nomination for ${training.name}`,
          link: `/trainings/${training._id}`,
          read: false,
        },
      },
      { upsert: true }
    );
  } catch (err) {
    if (err?.code !== 11000) console.error('decline notification failed', err);
  }
}

const ACTIONS = new Set(['accept', 'decline', 'attended', 'did_not_attend']);

router.get('/:token', asyncHandler(async (req, res) => {
  const nominee = await Nominee.findOne({ confirmation_token: req.params.token });
  if (!nominee) return res.status(404).json({ error: 'Invalid or expired confirmation link' });

  const training = await Training.findById(nominee.training);

  res.json({
    nominee: serializeNominee(nominee),
    training: serializeTraining(training),
  });
}));

router.post('/:token', confirmRateLimiter, asyncHandler(async (req, res) => {
  const { action, work_email, decline_reason } = req.body;
  if (!ACTIONS.has(action)) return res.status(400).json({ error: 'Unknown action' });

  const nominee = await Nominee.findOne({ confirmation_token: req.params.token });
  if (!nominee) return res.status(404).json({ error: 'Invalid or expired confirmation link' });

  if (!work_email || !nominee.email || work_email.trim().toLowerCase() !== nominee.email.trim().toLowerCase()) {
    return res.status(400).json({ error: 'Work email does not match our records for this nominee' });
  }

  const training = await Training.findById(nominee.training);
  if (!training) return res.status(404).json({ error: 'Invalid or expired confirmation link' });
  const ended = hasTrainingEnded(training.training_date, training.training_end_date);

  if (action === 'accept' || action === 'decline') {
    if (ended) return res.status(409).json({ error: 'This training has already taken place.' });

    const updated = await Nominee.findOneAndUpdate(
      { _id: nominee._id, nomination_status: 'Pending' },
      {
        $set: {
          nomination_status: action === 'accept' ? 'Accepted' : 'Declined',
          nomination_responded_at: new Date(),
          ...(action === 'decline' && decline_reason
            ? { decline_reason: String(decline_reason).trim().slice(0, 500) }
            : {}),
        },
      },
      { returnDocument: 'after' }
    );

    if (!updated) return res.json({ ...serializeNominee(nominee), already: true });

    if (action === 'decline') await recordDeclineNotification(updated, training);
    return res.json({ ...serializeNominee(updated), already: false });
  }

  if (!ended) return res.status(409).json({ error: 'This training has not finished yet.' });

  const updated = await Nominee.findOneAndUpdate(
    { _id: nominee._id, nomination_status: 'Accepted', attendance_self_reported: { $ne: true } },
    {
      $set: {
        attendance_status: action === 'attended' ? 'Attended' : 'Did Not Attend',
        attendance_self_reported: true,
        attendance_responded_at: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!updated) return res.json({ ...serializeNominee(nominee), already: true });

  res.json({ ...serializeNominee(updated), already: false });
}));

module.exports = router;