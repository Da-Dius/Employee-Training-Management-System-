const express = require('express');
const ExcelJS = require('exceljs');
const { Training } = require('../db/database');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function buildMonthlyReport({ month, category, department, name } = {}) {
  const match = {};
  if (month) match.training_date = { $regex: `^${escapeRegex(month)}` };
  if (category) match.category = category;
  if (name) match.name = { $regex: escapeRegex(name), $options: 'i' };

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'nominees',
        localField: '_id',
        foreignField: 'training',
        as: 'nominees',
      },
    },
  ];

  if (department) {
    pipeline.push({
      $match: { 'nominees.department': { $regex: escapeRegex(department), $options: 'i' } },
    });
  }

  pipeline.push(
    {
      $addFields: {
        nominee_count: {
          $size: {
            $filter: {
              input: '$nominees',
              as: 'n',
              cond: { $ne: ['$$n.nomination_status', 'Declined'] },
            },
          },
        },
        attendee_count: {
          $size: {
            $filter: {
              input: '$nominees',
              as: 'n',
              cond: {
                $and: [
                  { $ne: ['$$n.nomination_status', 'Declined'] },
                  { $eq: ['$$n.attendance_status', 'Attended'] },
                ],
              },
            },
          },
        },
        absentee_count: {
          $size: {
            $filter: {
              input: '$nominees',
              as: 'n',
              cond: {
                $and: [
                  { $ne: ['$$n.nomination_status', 'Declined'] },
                  { $eq: ['$$n.attendance_status', 'Did Not Attend'] },
                ],
              },
            },
          },
        },
        declined_count: {
          $size: {
            $filter: {
              input: '$nominees',
              as: 'n',
              cond: { $eq: ['$$n.nomination_status', 'Declined'] },
            },
          },
        },
      },
    },
    { $sort: { training_date: -1 } }
  );

  const rows = await Training.aggregate(pipeline);

  return rows.map((r) => ({
    id: r._id,
    name: r.name,
    category: r.category,
    training_date: r.training_date,
    venue: r.venue,
    nominee_count: r.nominee_count,
    attendee_count: r.attendee_count,
    absentee_count: r.absentee_count,
    declined_count: r.declined_count,
    cost: r.cost,
    paid: !!r.paid,
    per_diem: !!r.per_diem,
  }));
}

async function buildAttendeeReport({ month, category, department, name } = {}) {
  const trainingMatch = {};
  if (month) trainingMatch.training_date = { $regex: `^${escapeRegex(month)}` };
  if (category) trainingMatch.category = category;
  if (name) trainingMatch.name = { $regex: escapeRegex(name), $options: 'i' };

  const pipeline = [
    { $match: trainingMatch },
    {
      $lookup: {
        from: 'nominees',
        localField: '_id',
        foreignField: 'training',
        as: 'nominees',
      },
    },
    { $unwind: '$nominees' },
  ];

  if (department) {
    pipeline.push({
      $match: { 'nominees.department': { $regex: escapeRegex(department), $options: 'i' } },
    });
  }

  pipeline.push({ $sort: { training_date: -1, 'nominees.name': 1 } });

  const rows = await Training.aggregate(pipeline);

  return rows.map((r) => ({
    training_name: r.name,
    training_date: r.training_date,
    category: r.category,
    employee_name: r.nominees.name,
    employee_number: r.nominees.employee_number,
    department: r.nominees.department,
    division: r.nominees.division,
    section: r.nominees.section,
    station_region: r.nominees.station_region,
    nomination_status: r.nominees.nomination_status || 'Pending',
    decline_reason: r.nominees.decline_reason || null,
    attendance_status: r.nominees.attendance_status,
    attendance_self_reported: !!r.nominees.attendance_self_reported,
  }));
}

async function buildDepartmentStats({ month, category, name } = {}) {
  const trainingMatch = {};
  if (month) trainingMatch.training_date = { $regex: `^${escapeRegex(month)}` };
  if (category) trainingMatch.category = category;
  if (name) trainingMatch.name = { $regex: escapeRegex(name), $options: 'i' };

  const rows = await Training.aggregate([
    { $match: trainingMatch },
    {
      $lookup: {
        from: 'nominees',
        localField: '_id',
        foreignField: 'training',
        as: 'nominees',
      },
    },
    { $unwind: '$nominees' },
    {
      $group: {
        _id: { $ifNull: ['$nominees.department', 'Unspecified'] },
        nominee_count: {
          $sum: { $cond: [{ $ne: ['$nominees.nomination_status', 'Declined'] }, 1, 0] },
        },
        attendee_count: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$nominees.nomination_status', 'Declined'] },
                  { $eq: ['$nominees.attendance_status', 'Attended'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        declined_count: {
          $sum: { $cond: [{ $eq: ['$nominees.nomination_status', 'Declined'] }, 1, 0] },
        },
      },
    },
    { $sort: { nominee_count: -1 } },
  ]);

  return rows.map((r) => ({
    department: r._id,
    nominee_count: r.nominee_count,
    attendee_count: r.attendee_count,
    declined_count: r.declined_count,
  }));
}

router.get('/monthly', asyncHandler(async (req, res) => {
  const { month, category, department, name } = req.query;
  const rows = await buildMonthlyReport({ month, category, department, name });
  res.json(rows);
}));

router.get('/monthly/department-stats', asyncHandler(async (req, res) => {
  const { month, category, name } = req.query;
  const rows = await buildDepartmentStats({ month, category, name });
  res.json(rows);
}));

router.get('/monthly/export', asyncHandler(async (req, res) => {
  const { month, category, department, name } = req.query;
  const rows = await buildMonthlyReport({ month, category, department, name });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Monthly Report');

  sheet.columns = [
    { header: 'Training Name', key: 'name', width: 30 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Training Date', key: 'training_date', width: 15 },
    { header: 'Venue', key: 'venue', width: 20 },
    { header: 'Nominees', key: 'nominee_count', width: 10 },
    { header: 'Attendees', key: 'attendee_count', width: 10 },
    { header: 'Absentees', key: 'absentee_count', width: 10 },
    { header: 'Declined', key: 'declined_count', width: 10 },
    { header: 'Attendance Rate', key: 'attendance_rate', width: 14 },
    { header: 'Cost of Training', key: 'cost', width: 15 },
    { header: 'Paid or Free', key: 'paid_label', width: 12 },
    { header: 'Per Diem', key: 'per_diem_label', width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((r) => {
    sheet.addRow({
      name: r.name,
      category: r.category,
      training_date: r.training_date,
      venue: r.venue,
      nominee_count: r.nominee_count,
      attendee_count: r.attendee_count,
      absentee_count: r.absentee_count,
      declined_count: r.declined_count,
      attendance_rate: r.nominee_count > 0 ? `${Math.round((r.attendee_count / r.nominee_count) * 100)}%` : '-',
      cost: r.cost,
      paid_label: r.paid ? 'Paid' : 'Free',
      per_diem_label: r.per_diem ? 'Yes' : 'No',
    });
  });

  const monthLabel = month || 'all';
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="training-report-${monthLabel}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
}));

router.get('/monthly/attendees/export', asyncHandler(async (req, res) => {
  const { month, category, department, name } = req.query;
  const rows = await buildAttendeeReport({ month, category, department, name });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendee List');

  sheet.columns = [
    { header: 'Training Name', key: 'training_name', width: 30 },
    { header: 'Training Date', key: 'training_date', width: 15 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Employee Name', key: 'employee_name', width: 24 },
    { header: 'Employee Number', key: 'employee_number', width: 16 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Division', key: 'division', width: 18 },
    { header: 'Section', key: 'section', width: 16 },
    { header: 'Station/Region', key: 'station_region', width: 16 },
    { header: 'Nomination Status', key: 'nomination_status', width: 16 },
    { header: 'Decline Reason', key: 'decline_reason', width: 28 },
    { header: 'Attendance Status', key: 'attendance_status', width: 16 },
    { header: 'Attendance Self-Reported', key: 'self_reported_label', width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((r) => {
    sheet.addRow({
      training_name: r.training_name,
      training_date: r.training_date,
      category: r.category,
      employee_name: r.employee_name,
      employee_number: r.employee_number,
      department: r.department,
      division: r.division,
      section: r.section,
      station_region: r.station_region,
      nomination_status: r.nomination_status,
      decline_reason: r.decline_reason || '',
      attendance_status: r.attendance_status,
      self_reported_label: r.attendance_self_reported ? 'Yes' : 'No',
    });
  });

  const monthLabel = month || 'all';
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="attendee-list-${monthLabel}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
}));

module.exports = router;