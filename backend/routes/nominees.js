const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { mongoose, Training, Nominee, Employee, genToken } = require('../db/database');
const { sendConfirmationEmail } = require('../mailer');

const router = express.Router({ mergeParams: true });

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

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
    attendance_status: doc.attendanceStatus,
    employee_confirmed: !!doc.employeeConfirmed,
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
  existing.attendanceStatus = attendance_status ?? existing.attendanceStatus;

  await existing.save();

  res.json(serialize(existing));
}));

// PATCH /api/trainings/:trainingId/nominees/:nomineeId/attendance
router.patch('/:nomineeId/attendance', asyncHandler(async (req, res) => {
  const { attendance_status } = req.body;
  if (!['Attended', 'Did Not Attend', 'Pending'].includes(attendance_status)) {
    return res.status(400).json({ error: 'Invalid attendance_status' });
  }

  if (!isValidId(req.params.trainingId) || !isValidId(req.params.nomineeId)) {
    return res.status(404).json({ error: 'Nominee not found' });
  }
  const existing = await Nominee.findOne({ _id: req.params.nomineeId, training: req.params.trainingId });
  if (!existing) return res.status(404).json({ error: 'Nominee not found' });

  existing.attendanceStatus = attendance_status;
  await existing.save();

  res.json(serialize(existing));
}));

// POST /api/trainings/:trainingId/nominees/:nomineeId/send-confirmation
// Sends one confirmation email to one nominee — separate from "Copy All Links", which
// stays available as a manual fallback for whoever prefers sending it themselves.
router.post('/:nomineeId/send-confirmation', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.nomineeId)) {
    return res.status(404).json({ error: 'Nominee not found' });
  }
  const training = await Training.findById(req.params.trainingId).select('name trainingDate');
  if (!training) return res.status(404).json({ error: 'Training not found' });

  const nominee = await Nominee.findOne({ _id: req.params.nomineeId, training: req.params.trainingId });
  if (!nominee) return res.status(404).json({ error: 'Nominee not found' });
  if (!nominee.email) return res.status(400).json({ error: 'This nominee has no work email on file' });

  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const confirmUrl = `${baseUrl}/confirm.html?token=${nominee.confirmationToken}`;

  await sendConfirmationEmail({
    to: nominee.email,
    nomineeName: nominee.name,
    trainingName: training.name,
    trainingDate: training.trainingDate,
    confirmUrl,
  });

  nominee.linkSentAt = new Date();
  await nominee.save();

  res.json(serialize(nominee));
}));

router.delete('/:nomineeId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.nomineeId)) {
    return res.status(404).json({ error: 'Nominee not found' });
  }
  const existing = await Nominee.findOne({ _id: req.params.nomineeId, training: req.params.trainingId });
  if (!existing) return res.status(404).json({ error: 'Nominee not found' });

  await Nominee.deleteOne({ _id: req.params.nomineeId });
  res.status(204).end();
}));

module.exports = router;