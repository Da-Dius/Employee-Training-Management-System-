const express = require('express');
const { Training, Nominee, Notification, hasTrainingEnded } = require('../db/database');
const confirmRateLimiter = require('../middleware/confirmRateLimiter');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

// Deliberately narrower than the HR-facing serializer in routes/nominees.js: this
// endpoint is unauthenticated, so it must not leak the replacement chain. Telling a
// replacement employee whose slot they took is HR's business, not theirs.
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
    nomination_status: doc.nominationStatus || 'Pending',
    nomination_responded_at: doc.nominationRespondedAt || null,
    decline_reason: doc.declineReason || null,
    attendance_status: doc.attendanceStatus,
    attendance_self_reported: !!doc.attendanceSelfReported,
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
    training_end_date: doc.trainingEndDate || null,
    venue: doc.venue,
    cost: doc.cost,
    paid: !!doc.paid,
    per_diem: !!doc.perDiem,
    description: doc.description,
    // Computed server-side so the confirmation page never has to do timezone maths to
    // work out which question it should be asking.
    has_ended: hasTrainingEnded(doc.trainingDate, doc.trainingEndDate),
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

// Written inline here rather than by the sync-on-read pass in routes/notifications.js:
// that pass derives notifications from Training state on every poll, and nothing polls
// nominee state. A decline is an event on an unauthenticated POST, so this is the only
// moment we know it happened.
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
    // A concurrent upsert can still race into E11000 against the unique {type, refId}
    // index — but the notification then already exists, which is the desired end state.
    // Never fail the employee's decline over a bookkeeping row.
    if (err?.code !== 11000) console.error('decline notification failed', err);
  }
}

const ACTIONS = new Set(['accept', 'decline', 'attended', 'did_not_attend']);

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

// POST /api/confirm/:token - the employee answers, using their work email as identity.
// One token covers both questions in the lifecycle: accept/decline the nomination
// before the training, then "did you actually attend?" after it has ended.
router.post('/:token', confirmRateLimiter, asyncHandler(async (req, res) => {
  const { action, work_email, decline_reason } = req.body;
  if (!ACTIONS.has(action)) return res.status(400).json({ error: 'Unknown action' });

  const nominee = await Nominee.findOne({ confirmationToken: req.params.token });
  if (!nominee) return res.status(404).json({ error: 'Invalid or expired confirmation link' });

  // Unchanged identity proof: the work email only has to match, it is never written back.
  if (!work_email || !nominee.email || work_email.trim().toLowerCase() !== nominee.email.trim().toLowerCase()) {
    return res.status(400).json({ error: 'Work email does not match our records for this nominee' });
  }

  const training = await Training.findById(nominee.training);
  if (!training) return res.status(404).json({ error: 'Invalid or expired confirmation link' });
  const ended = hasTrainingEnded(training.trainingDate, training.trainingEndDate);

  if (action === 'accept' || action === 'decline') {
    if (ended) return res.status(409).json({ error: 'This training has already taken place.' });

    // The precondition lives in the FILTER, not in an if-statement above a save():
    // two simultaneous clicks would both pass a read-then-write check, but only one of
    // them can match here.
    const updated = await Nominee.findOneAndUpdate(
      { _id: nominee._id, nominationStatus: 'Pending' },
      {
        $set: {
          nominationStatus: action === 'accept' ? 'Accepted' : 'Declined',
          nominationRespondedAt: new Date(),
          ...(action === 'decline' && decline_reason
            ? { declineReason: String(decline_reason).trim().slice(0, 500) }
            : {}),
        },
      },
      { returnDocument: 'after' }
    );

    // No match means they had already answered (double-click, or a link replayed weeks
    // later). That isn't an error — return the current state so the page renders its
    // terminal screen instead of an alarming red banner.
    if (!updated) return res.json({ ...serializeNominee(nominee), already: true });

    if (action === 'decline') await recordDeclineNotification(updated, training);
    return res.json({ ...serializeNominee(updated), already: false });
  }

  // --- post-training attendance self-report ---
  if (!ended) return res.status(409).json({ error: 'This training has not finished yet.' });

  const updated = await Nominee.findOneAndUpdate(
    // `$ne: true` rather than `false` so nominees created before this field existed,
    // which have no such key at all, still match.
    { _id: nominee._id, nominationStatus: 'Accepted', attendanceSelfReported: { $ne: true } },
    {
      $set: {
        attendanceStatus: action === 'attended' ? 'Attended' : 'Did Not Attend',
        attendanceSelfReported: true,
        attendanceRespondedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );
  if (!updated) return res.json({ ...serializeNominee(nominee), already: true });

  res.json({ ...serializeNominee(updated), already: false });
}));

module.exports = router;
