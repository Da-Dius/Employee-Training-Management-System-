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

const ATTENDANCE_STATUSES = ['Pending', 'Attended', 'Did Not Attend'];

function serialize(doc) {
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

    replaced_by_id: doc.replaced_by || null,
    replaces_nominee_id: doc.replaces_nominee || null,

    attendance_status: doc.attendance_status,
    attendance_self_reported: !!doc.attendance_self_reported,
    attendance_responded_at: doc.attendance_responded_at || null,
    attendance_request_sent_at: doc.attendance_request_sent_at || null,

    confirmation_token: doc.confirmation_token,
    link_sent_at: doc.link_sent_at,
    created_at: doc.createdAt,
  };
}

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
    employee_number,
    department: department || undefined,
    division: division || undefined,
    section: section || undefined,
    station_region: station_region || undefined,
    email: email || undefined,
    confirmation_token: genToken(),
  });

  res.status(201).json(serialize(doc));
}));

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
    if (rowNumber === 1) return;
    const raw = row.getCell(1).value;
    const employeeNumber = raw === null || raw === undefined ? '' : String(raw).trim();
    if (employeeNumber) employeeNumbers.push(employeeNumber);
  });

  const existingNominees = await Nominee.find({ training: req.params.trainingId }).select('employee_number');
  const seen = new Set(existingNominees.map((n) => n.employee_number));

  const imported = [];
  const skipped = [];

  for (const employeeNumber of employeeNumbers) {
    if (seen.has(employeeNumber)) {
      skipped.push({ employee_number: employeeNumber, reason: 'Already a nominee for this training' });
      continue;
    }

    const employee = await Employee.findOne({ employee_number: employeeNumber });
    if (!employee) {
      skipped.push({ employee_number: employeeNumber, reason: 'Not found in employee directory' });
      continue;
    }

    const doc = await Nominee.create({
      training: req.params.trainingId,
      name: employee.name,
      employee_number: employee.employee_number,
      department: employee.department || undefined,
      division: employee.division || undefined,
      section: employee.section || undefined,
      station_region: employee.station_region || undefined,
      email: employee.email || undefined,
      confirmation_token: genToken(),
    });

    seen.add(employeeNumber);
    imported.push(serialize(doc));
  }

  res.status(201).json({ imported, skipped });
}));

router.post('/request-attendance-confirmation', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId)) return res.status(404).json({ error: 'Training not found' });
  const training = await Training.findById(req.params.trainingId).select('name training_date training_end_date');
  if (!training) return res.status(404).json({ error: 'Training not found' });

  if (!hasTrainingEnded(training.training_date, training.training_end_date)) {
    return res.status(400).json({ error: 'This training has not finished yet' });
  }

  const nominees = await Nominee.find({
    training: req.params.trainingId,
    nomination_status: 'Accepted',
  }).sort({ name: 1 });

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
    if (nominee.attendance_self_reported) {
      skipped.push({ name: nominee.name, reason: 'Already answered' });
      continue;
    }
    try {
      await sendAttendanceCheckEmail({
        to: nominee.email,
        nomineeName: nominee.name,
        trainingName: training.name,
        trainingDate: training.training_date,
        trainingEndDate: training.training_end_date,
        confirmUrl: `${baseUrl}/confirm.html?token=${nominee.confirmation_token}`,
      });
      nominee.attendance_request_sent_at = new Date();
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
  existing.employee_number = employee_number ?? existing.employee_number;
  existing.department = department ?? existing.department;
  existing.division = division ?? existing.division;
  existing.section = section ?? existing.section;
  existing.station_region = station_region ?? existing.station_region;
  existing.email = email ?? existing.email;

  if (attendance_status !== undefined) {
    if (!ATTENDANCE_STATUSES.includes(attendance_status)) {
      return res.status(400).json({ error: 'Invalid attendance_status' });
    }
    if (existing.nomination_status === 'Declined') {
      return res.status(409).json({ error: 'This nominee declined the nomination — add a replacement instead' });
    }
    existing.attendance_status = attendance_status;
  }

  await existing.save();

  res.json(serialize(existing));
}));

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

  if (existing.nomination_status === 'Declined') {
    return res.status(409).json({ error: 'This nominee declined the nomination and is excluded from attendance' });
  }

  existing.attendance_status = attendance_status;
  await existing.save();

  res.json(serialize(existing));
}));

router.post('/:nomineeId/send-confirmation', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.nomineeId)) {
    return res.status(404).json({ error: 'Nominee not found' });
  }
  const training = await Training.findById(req.params.trainingId).select('name training_date training_end_date');
  if (!training) return res.status(404).json({ error: 'Training not found' });

  const nominee = await Nominee.findOne({ _id: req.params.nomineeId, training: req.params.trainingId });
  if (!nominee) return res.status(404).json({ error: 'Nominee not found' });
  if (!nominee.email) return res.status(400).json({ error: 'This nominee has no work email on file' });

  if (nominee.nomination_status === 'Declined') {
    return res.status(409).json({ error: 'This nominee has declined — add a replacement instead' });
  }

  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const confirmUrl = `${baseUrl}/confirm.html?token=${nominee.confirmation_token}`;

  await sendNominationEmail({
    to: nominee.email,
    nomineeName: nominee.name,
    trainingName: training.name,
    trainingDate: training.training_date,
    trainingEndDate: training.training_end_date,
    confirmUrl,
  });

  nominee.link_sent_at = new Date();
  await nominee.save();

  res.json(serialize(nominee));
}));

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
  if (declined.nomination_status !== 'Declined') {
    return res.status(400).json({ error: 'Only a nominee who declined can be replaced' });
  }

  const duplicate = await Nominee.findOne({
    training: req.params.trainingId,
    employee_number: employee_number,
  });
  if (duplicate) {
    return res.status(409).json({ error: 'That employee is already a nominee on this training' });
  }

  const replacementId = new mongoose.Types.ObjectId();
  const claimed = await Nominee.findOneAndUpdate(
    {
      _id: declined._id,
      training: req.params.trainingId,
      nomination_status: 'Declined',
      replaced_by: { $exists: false },
    },
    { $set: { replaced_by: replacementId } },
    { returnDocument: 'after' }
  );
  if (!claimed) return res.status(409).json({ error: 'This nominee has already been replaced' });

  let replacement;
  try {
    replacement = await Nominee.create({
      _id: replacementId,
      training: req.params.trainingId,
      name,
      employee_number: employee_number,
      department: department || undefined,
      division: division || undefined,
      section: section || undefined,
      station_region: station_region || undefined,
      email: email || undefined,
      replaces_nominee: declined._id,
      confirmation_token: genToken(),
    });
  } catch (err) {
    await Nominee.updateOne({ _id: declined._id }, { $unset: { replaced_by: '' } });
    throw err;
  }

  res.status(201).json({ replacement: serialize(replacement), replaced: serialize(claimed) });
}));

router.delete('/:nomineeId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.nomineeId)) {
    return res.status(404).json({ error: 'Nominee not found' });
  }
  const existing = await Nominee.findOne({ _id: req.params.nomineeId, training: req.params.trainingId });
  if (!existing) return res.status(404).json({ error: 'Nominee not found' });

  await Nominee.deleteOne({ _id: req.params.nomineeId });

  await Notification.deleteOne({ type: 'nominee_declined', refId: existing._id });
  if (existing.replaces_nominee) {
    await Nominee.updateOne({ _id: existing.replaces_nominee }, { $unset: { replaced_by: '' } });
  }
  if (existing.replaced_by) {
    await Nominee.updateOne({ _id: existing.replaced_by }, { $unset: { replaces_nominee: '' } });
  }

  res.status(204).end();
}));

module.exports = router;