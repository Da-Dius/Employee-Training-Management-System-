const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const {
  mongoose, Training, Nominee, Employee, Notification, genToken, hasTrainingEnded, nairobiDateString,
} = require('../db/database');
const { sendNominationEmail, sendAttendanceCheckEmail } = require('../mailer');
const { asyncHandler, isValidId } = require('../lib/http');

const router = express.Router({ mergeParams: true });

const ATTENDANCE_STATUSES = ['Pending', 'Attended', 'Did Not Attend'];

// Attendance opens once a training has started (so multi-day trainings can be marked as they
// run); resetting a mark back to Pending is always allowed.
async function attendanceNotOpenYet(trainingId, status) {
  if (status === 'Pending') return false;
  const training = await Training.findById(trainingId).select('training_date');
  return !!training && training.training_date > nairobiDateString();
}

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

// POST /api/trainings/:trainingId/nominees
router.post('/', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId)) return res.status(404).json({ error: 'Program not found' });
  const training = await Training.findById(req.params.trainingId).select('_id');
  if (!training) return res.status(404).json({ error: 'Program not found' });

  const { name, employee_number, department, division, section, station_region, email } = req.body;
  if (!name || !employee_number) {
    return res.status(400).json({ error: 'name and employee_number are required' });
  }

  const duplicate = await Nominee.exists({ training: req.params.trainingId, employee_number });
  if (duplicate) {
    return res.status(409).json({ error: 'That employee is already a nominee on this program' });
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

// POST /api/trainings/:trainingId/nominees/import
router.post('/import', importUpload.single('file'), asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId)) return res.status(404).json({ error: 'Program not found' });
  const training = await Training.findById(req.params.trainingId).select('_id');
  if (!training) return res.status(404).json({ error: 'Program not found' });
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

  const rows = [];
  let cols = { name: 1, empNum: 2, email: 3, dept: 4, div: 5, sec: 6, station: 7 };

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        const header = String(cell.text || '').toLowerCase().trim();
        if (['employee_number', 'employee number', 'id'].includes(header)) cols.empNum = colNumber;
        if (['name', 'employee name', 'full name'].includes(header)) cols.name = colNumber;
        if (['email', 'email address'].includes(header)) cols.email = colNumber;
        if (['department'].includes(header)) cols.dept = colNumber;
        if (['division'].includes(header)) cols.div = colNumber;
        if (['section'].includes(header)) cols.sec = colNumber;
        if (['station_region', 'station', 'region', 'station/region'].includes(header)) cols.station = colNumber;
      });
      return;
    }

    const employeeNumber = String(row.getCell(cols.empNum).text ?? '').trim();
    const name = String(row.getCell(cols.name).text ?? '').trim();
    const email = String(row.getCell(cols.email).text ?? '').trim();
    const department = String(row.getCell(cols.dept).text ?? '').trim();
    const division = String(row.getCell(cols.div).text ?? '').trim();
    const section = String(row.getCell(cols.sec).text ?? '').trim();
    const station_region = String(row.getCell(cols.station).text ?? '').trim();

    if (employeeNumber) {
      rows.push({ employeeNumber, name, email, department, division, section, station_region });
    }
  });

  const existingNominees = await Nominee.find({ training: req.params.trainingId }).select('employee_number');
  const seen = new Set(existingNominees.map((n) => n.employee_number));

  const imported = [];
  const skipped = [];

  for (const rowData of rows) {
    if (seen.has(rowData.employeeNumber)) {
      skipped.push({ employee_number: rowData.employeeNumber, reason: 'Already a nominee for this program' });
      continue;
    }

    let employee = await Employee.findOne({ employee_number: rowData.employeeNumber });

    if (!employee) {
      if (!rowData.name) {
        skipped.push({ employee_number: rowData.employeeNumber, reason: 'Cannot create new employee: Name is missing in Excel' });
        continue;
      }

      try {
        employee = await Employee.create({
          employee_number: rowData.employeeNumber,
          name: rowData.name,
          email: rowData.email || undefined,
          department: rowData.department || undefined,
          division: rowData.division || undefined,
          section: rowData.section || undefined,
          station_region: rowData.station_region || undefined,
        });
      } catch (err) {
        console.error("Failed to auto-create employee:", err);
        skipped.push({ employee_number: rowData.employeeNumber, reason: 'System error while generating employee profile' });
        continue;
      }
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

    seen.add(rowData.employeeNumber);
    imported.push(serialize(doc));
  }

  res.status(201).json({ imported, skipped });
}));


// POST /api/trainings/:trainingId/nominees/request-attendance-confirmation
// Notice how this sits right below /import, and ABOVE the /:nomineeId routes!
router.post('/request-attendance-confirmation', asyncHandler(async (req, res) => {
  const { trainingId } = req.params;

  if (!isValidId(trainingId)) return res.status(404).json({ error: 'Program not found' });
  const training = await Training.findById(trainingId).select('name');
  if (!training) return res.status(404).json({ error: 'Program not found' });

  const nominees = await Nominee.find({
    training: trainingId,
    nomination_status: 'Accepted',
    attendance_status: 'Pending'
  });

  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  let sentCount = 0;
  let skippedCount = 0;

  for (const nominee of nominees) {
    if (!nominee.email) {
      skippedCount++;
      continue;
    }

    const confirmUrl = `${baseUrl}/attendance.html?token=${nominee.confirmation_token}`;

    try {
      await sendAttendanceCheckEmail(
        nominee.email,
        nominee.name,
        training.name,
        confirmUrl
      );

      nominee.attendance_request_sent_at = new Date();
      await nominee.save();
      sentCount++;
    } catch (err) {
      console.error(`Failed to send email to ${nominee.email}:`, err);
      skippedCount++;
    }
  }

  res.json({
    message: `Success! Sent ${sentCount} emails. Skipped ${skippedCount} (missing email or failed).`
  });
}));


// ---------------------------------------------------------
// DYNAMIC PARAMETER ROUTES BELOW THIS LINE (/:nomineeId)
// ---------------------------------------------------------


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
    if (await attendanceNotOpenYet(req.params.trainingId, attendance_status)) {
      return res.status(409).json({ error: 'Attendance can only be recorded once the program has started' });
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
  if (await attendanceNotOpenYet(req.params.trainingId, attendance_status)) {
    return res.status(409).json({ error: 'Attendance can only be recorded once the program has started' });
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
  if (!training) return res.status(404).json({ error: 'Program not found' });

  const nominee = await Nominee.findOne({ _id: req.params.nomineeId, training: req.params.trainingId });
  if (!nominee) return res.status(404).json({ error: 'Nominee not found' });
  if (!nominee.email) return res.status(400).json({ error: 'This nominee has no work email on file' });

  if (nominee.nomination_status === 'Declined') {
    return res.status(409).json({ error: 'This nominee has declined — add a replacement instead' });
  }

  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const confirmUrl = `${baseUrl}/confirm.html?token=${nominee.confirmation_token}`;

  try {
    await sendNominationEmail({
      to: nominee.email,
      nomineeName: nominee.name,
      trainingName: training.name,
      trainingDate: training.training_date,
      trainingEndDate: training.training_end_date,
      confirmUrl,
    });
  } catch (err) {
    console.error('nomination email failed', nominee.email, err);
    return res.status(502).json({
      error: 'The email could not be sent. Check the email settings (GMAIL_USER and GMAIL_APP_PASSWORD) or copy the link instead.',
    });
  }

  nominee.link_sent_at = new Date();
  await nominee.save();

  res.json(serialize(nominee));
}));

router.post('/:nomineeId/replace', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.trainingId) || !isValidId(req.params.nomineeId)) {
    return res.status(404).json({ error: 'Nominee not found' });
  }
  const training = await Training.findById(req.params.trainingId).select('_id');
  if (!training) return res.status(404).json({ error: 'Program not found' });

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
    return res.status(409).json({ error: 'That employee is already a nominee on this program' });
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