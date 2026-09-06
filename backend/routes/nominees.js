const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const {
  mongoose, Training, Nominee, Employee, Notification, genToken, hasTrainingEnded,
} = require('../db/database');
const { sendNominationEmail, sendAttendanceCheckEmail } = require('../mailer');

const router = express.Router({ mergeParams: true });

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// The whole attendance vocabulary, in one place. Note that 'Declined' is deliberately
// NOT here — declining is a *nomination* status, a separate axis, and mixing the two
// would corrupt every report filter that counts attendees and absentees.
const ATTENDANCE_STATUSES = ['Pending', 'Attended', 'Did Not Attend'];

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

    nomination_status: doc.nominationStatus || 'Pending',
    nomination_responded_at: doc.nominationRespondedAt || null,
    decline_reason: doc.declineReason || null,
    // Raw ids, never populated: both ends of a replacement pair are always nominees on
    // the same training, so the list the frontend already holds resolves them to names.
    // Populating here would break every other caller of serialize() — POST/PUT/PATCH all
    // pass an unpopulated doc, where doc.replacedBy.name is undefined.
    replaced_by_id: doc.replacedBy || null,
    replaces_nominee_id: doc.replacesNominee || null,

    attendance_status: doc.attendanceStatus,
    attendance_self_reported: !!doc.attendanceSelfReported,
    attendance_responded_at: doc.attendanceRespondedAt || null,
    attendance_request_sent_at: doc.attendanceRequestSentAt || null,

    confirmation_token: doc.confirmationToken,
    link_sent_at: doc.linkSentAt,
    created_at: doc.createdAt,
  };
}

// Import file only needs to be parsed then discarded — memory storage, no disk write,
// unlike the LPO/evidence uploads which are kept long-term.
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

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

// POST /api/trainings/:trainingId/nominees/import  (multipart/form-data, field "file", .xlsx)
// Only reads Employee Number from column A of each row (header row optional/ignored).
// Every other field (name, department, division, section, station, email) is looked up
// from the existing Employee directory — the same source of truth the manual "Add
// Nominee" search already uses — rather than trusting free-text spreadsheet columns
// that could contain typos or stale data.
router.post('/import', importUpload.single('file'), asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId)) return res.status(404).json({ error: 'Training not found' });
  const training = await Training.findById(req.params.trainingId).select('_id');
  if (!training) return res.status(404).json({ error: 'Training not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
  } catch {
    return res.status(400).json({ error: 'Could not read this file — please upload a valid .xlsx file' });
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return res.status(400).json({ error: 'No worksheet found in file' });

  const employeeNumbers = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header row, skipped unconditionally
    const raw = row.getCell(1).value;
    const employeeNumber = raw === null || raw === undefined ? '' : String(raw).trim();
    if (employeeNumber) employeeNumbers.push(employeeNumber);
  });

  const existingNominees = await Nominee.find({ training: req.params.trainingId }).select('employeeNumber');
  const seen = new Set(existingNominees.map((n) => n.employeeNumber));

  const imported = [];
  const skipped = [];

  for (const employeeNumber of employeeNumbers) {
    if (seen.has(employeeNumber)) {
      skipped.push({ employee_number: employeeNumber, reason: 'Already a nominee for this training' });
      continue;
    }

    const employee = await Employee.findOne({ employeeNumber });
    if (!employee) {
      skipped.push({ employee_number: employeeNumber, reason: 'Not found in employee directory' });
      continue;
    }

    const doc = await Nominee.create({
      training: req.params.trainingId,
      name: employee.name,
      employeeNumber: employee.employeeNumber,
      department: employee.department || undefined,
      division: employee.division || undefined,
      section: employee.section || undefined,
      stationRegion: employee.stationRegion || undefined,
      email: employee.email || undefined,
      confirmationToken: genToken(),
    });

    seen.add(employeeNumber);
    imported.push(serialize(doc));
  }

  res.status(201).json({ imported, skipped });
}));

// POST /api/trainings/:trainingId/nominees/request-attendance-confirmation
// HR-triggered once the training has ended: asks everyone who accepted whether they
// actually turned up. Registered here beside /import, alongside the other single-segment
// POST, so a future POST /:nomineeId could never shadow it.
//
// Deliberately ONE bulk endpoint rather than the N-parallel-calls pattern that
// AttendancePage's "Mark All Attended" uses: those are cheap DB writes, these are SMTP
// sends through a single shared Gmail transporter. Sending sequentially and returning a
// per-recipient report — the same { sent, skipped } shape /import already returns — means
// one bad address doesn't abort the batch and HR can see exactly who was missed.
router.post('/request-attendance-confirmation', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId)) return res.status(404).json({ error: 'Training not found' });
  const training = await Training.findById(req.params.trainingId).select('name trainingDate trainingEndDate');
  if (!training) return res.status(404).json({ error: 'Training not found' });

  if (!hasTrainingEnded(training.trainingDate, training.trainingEndDate)) {
    return res.status(400).json({ error: 'This training has not finished yet' });
  }

  const nominees = await Nominee.find({
    training: req.params.trainingId,
    nominationStatus: 'Accepted',
  }).sort({ name: 1 });

  // Sequential SMTP at roughly a second each means a large cohort would hold the request
  // open long enough for a production reverse proxy to cut it. Copy All Links is the
  // documented fallback; the real fix past this point is a job queue, not parallel sends.
  if (nominees.length > 100) {
    return res.status(400).json({ error: 'Too many recipients for one batch — use Copy All Links instead' });
  }

  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const sent = [];
  const skipped = [];

  for (const nominee of nominees) {
    if (!nominee.email) {
      skipped.push({ name: nominee.name, reason: 'No work email on file' });
      continue;
    }
    if (nominee.attendanceSelfReported) {
      skipped.push({ name: nominee.name, reason: 'Already answered' });
      continue;
    }
    try {
      await sendAttendanceCheckEmail({
        to: nominee.email,
        nomineeName: nominee.name,
        trainingName: training.name,
        trainingDate: training.trainingDate,
        trainingEndDate: training.trainingEndDate,
        confirmUrl: `${baseUrl}/confirm.html?token=${nominee.confirmationToken}`,
      });
      nominee.attendanceRequestSentAt = new Date();
      await nominee.save();
      sent.push(serialize(nominee));
    } catch (err) {
      console.error('attendance check email failed', nominee.email, err);
      skipped.push({ name: nominee.name, reason: 'Email failed to send' });
    }
  }

  res.json({ sent, skipped });
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

  // This used to be an unvalidated `?? existing.attendanceStatus` passthrough, which let
  // any string through on a route the PATCH below carefully guards. Same rules both ways.
  if (attendance_status !== undefined) {
    if (!ATTENDANCE_STATUSES.includes(attendance_status)) {
      return res.status(400).json({ error: 'Invalid attendance_status' });
    }
    if (existing.nominationStatus === 'Declined') {
      return res.status(409).json({ error: 'This nominee declined the nomination — add a replacement instead' });
    }
    existing.attendanceStatus = attendance_status;
  }
  // nominationStatus is deliberately not settable here: it moves only when the employee
  // answers their own link, or via the /replace route below.

  await existing.save();

  res.json(serialize(existing));
}));

// PATCH /api/trainings/:trainingId/nominees/:nomineeId/attendance
router.patch('/:nomineeId/attendance', asyncHandler(async (req, res) => {
  const { attendance_status } = req.body;
  if (!ATTENDANCE_STATUSES.includes(attendance_status)) {
    return res.status(400).json({ error: 'Invalid attendance_status' });
  }

  if (!isValidId(req.params.trainingId) || !isValidId(req.params.nomineeId)) {
    return res.status(404).json({ error: 'Nominee not found' });
  }
  const existing = await Nominee.findOne({ _id: req.params.nomineeId, training: req.params.trainingId });
  if (!existing) return res.status(404).json({ error: 'Nominee not found' });

  if (existing.nominationStatus === 'Declined') {
    return res.status(409).json({ error: 'This nominee declined the nomination and is excluded from attendance' });
  }

  // Note we do NOT clear attendanceSelfReported on an HR override: that flag records the
  // fact that the employee answered, while the status is the current truth.
  existing.attendanceStatus = attendance_status;
  await existing.save();

  res.json(serialize(existing));
}));

// POST /api/trainings/:trainingId/nominees/:nomineeId/send-confirmation
// Sends one nomination email to one nominee — separate from "Copy All Links", which
// stays available as a manual fallback for whoever prefers sending it themselves.
router.post('/:nomineeId/send-confirmation', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.nomineeId)) {
    return res.status(404).json({ error: 'Nominee not found' });
  }
  const training = await Training.findById(req.params.trainingId).select('name trainingDate trainingEndDate');
  if (!training) return res.status(404).json({ error: 'Training not found' });

  const nominee = await Nominee.findOne({ _id: req.params.nomineeId, training: req.params.trainingId });
  if (!nominee) return res.status(404).json({ error: 'Nominee not found' });
  if (!nominee.email) return res.status(400).json({ error: 'This nominee has no work email on file' });
  // Re-sending to someone who accepted is a harmless reminder; re-sending to someone who
  // already said no is not — the answer is to nominate someone else.
  if (nominee.nominationStatus === 'Declined') {
    return res.status(409).json({ error: 'This nominee has declined — add a replacement instead' });
  }

  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const confirmUrl = `${baseUrl}/confirm.html?token=${nominee.confirmationToken}`;

  await sendNominationEmail({
    to: nominee.email,
    nomineeName: nominee.name,
    trainingName: training.name,
    trainingDate: training.trainingDate,
    trainingEndDate: training.trainingEndDate,
    confirmUrl,
  });

  nominee.linkSentAt = new Date();
  await nominee.save();

  res.json(serialize(nominee));
}));

// POST /api/trainings/:trainingId/nominees/:nomineeId/replace
// Replacing a decliner: their row STAYS, marked Declined, and the replacement is a new
// row linked back to them. Nobody is deleted — declined nominees are the audit trail of
// who dropped out and why.
router.post('/:nomineeId/replace', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.nomineeId)) {
    return res.status(404).json({ error: 'Nominee not found' });
  }
  const training = await Training.findById(req.params.trainingId).select('_id');
  if (!training) return res.status(404).json({ error: 'Training not found' });

  const { name, employee_number, department, division, section, station_region, email } = req.body;
  if (!name || !employee_number) {
    return res.status(400).json({ error: 'name and employee_number are required' });
  }

  const declined = await Nominee.findOne({ _id: req.params.nomineeId, training: req.params.trainingId });
  if (!declined) return res.status(404).json({ error: 'Nominee not found' });
  if (declined.nominationStatus !== 'Declined') {
    return res.status(400).json({ error: 'Only a nominee who declined can be replaced' });
  }

  // POST / has no duplicate check (unlike /import); this path needs one, because the
  // modal's client-side exclusion is a convenience, not a guarantee.
  const duplicate = await Nominee.findOne({
    training: req.params.trainingId,
    employeeNumber: employee_number,
  });
  if (duplicate) {
    return res.status(409).json({ error: 'That employee is already a nominee on this training' });
  }

  // Mint the id up front so the decliner's slot can be claimed atomically BEFORE the
  // replacement row exists. Doing it the other way round — create, then claim — leaves an
  // orphan nominee behind whenever the claim loses a race.
  const replacementId = new mongoose.Types.ObjectId();
  const claimed = await Nominee.findOneAndUpdate(
    {
      _id: declined._id,
      training: req.params.trainingId,
      nominationStatus: 'Declined',
      replacedBy: { $exists: false },
    },
    { $set: { replacedBy: replacementId } },
    { returnDocument: 'after' }
  );
  if (!claimed) return res.status(409).json({ error: 'This nominee has already been replaced' });

  let replacement;
  try {
    replacement = await Nominee.create({
      _id: replacementId,
      training: req.params.trainingId,
      name,
      employeeNumber: employee_number,
      department: department || undefined,
      division: division || undefined,
      section: section || undefined,
      stationRegion: station_region || undefined,
      email: email || undefined,
      replacesNominee: declined._id,
      confirmationToken: genToken(),
    });
  } catch (err) {
    // Release the claim so the decliner never points at a row that was never created.
    await Nominee.updateOne({ _id: declined._id }, { $unset: { replacedBy: '' } });
    throw err;
  }

  // The replacement starts Pending with its own fresh token: HR sends them the normal
  // nomination email and they accept or decline like anyone else. A replacement can
  // itself decline and be replaced again — the chain is just a linked list.
  res.status(201).json({ replacement: serialize(replacement), replaced: serialize(claimed) });
}));

router.delete('/:nomineeId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.nomineeId)) {
    return res.status(404).json({ error: 'Nominee not found' });
  }
  const existing = await Nominee.findOne({ _id: req.params.nomineeId, training: req.params.trainingId });
  if (!existing) return res.status(404).json({ error: 'Nominee not found' });

  await Nominee.deleteOne({ _id: req.params.nomineeId });

  // A hard delete with no cascade was fine while nothing referenced a nominee. It now
  // does: a decline notification keyed on this id, and up to two link fields on
  // neighbouring rows that would otherwise render "replaced by <nobody>".
  await Notification.deleteOne({ type: 'nominee_declined', refId: existing._id });
  if (existing.replacesNominee) {
    await Nominee.updateOne({ _id: existing.replacesNominee }, { $unset: { replacedBy: '' } });
  }
  if (existing.replacedBy) {
    await Nominee.updateOne({ _id: existing.replacedBy }, { $unset: { replacesNominee: '' } });
  }

  res.status(204).end();
}));

module.exports = router;