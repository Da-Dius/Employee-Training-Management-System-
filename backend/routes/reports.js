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

// GET /api/reports/monthly?month=2026-07&category=Technical&department=Finance&name=digital
async function buildMonthlyReport({ month, category, department, name } = {}) {
  const match = {};
  if (month) match.trainingDate = { $regex: `^${escapeRegex(month)}` };
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
        nominee_count: { $size: '$nominees' },
        attendee_count: {
          $size: {
            $filter: {
              input: '$nominees',
              as: 'n',
              cond: { $eq: ['$$n.attendanceStatus', 'Attended'] },
            },
          },
        },
        absentee_count: {
          $size: {
            $filter: {
              input: '$nominees',
              as: 'n',
              cond: { $eq: ['$$n.attendanceStatus', 'Did Not Attend'] },
            },
          },
        },
      },
    },
    { $sort: { trainingDate: -1 } }
  );

  const rows = await Training.aggregate(pipeline);

  return rows.map((r) => ({
    id: r._id,
    name: r.name,
    category: r.category,
    training_date: r.trainingDate,
    end_date: r.endDate || null,
    venue: r.venue,
    nominee_count: r.nominee_count,
    attendee_count: r.attendee_count,
    absentee_count: r.absentee_count,
    cost: r.cost,
    paid: !!r.paid,
    per_diem: !!r.perDiem,
  }));
}

// One row per nominee, not per training — for people who need names, not just counts.
async function buildAttendeeReport({ month, category, department, name } = {}) {
  const trainingMatch = {};
  if (month) trainingMatch.trainingDate = { $regex: `^${escapeRegex(month)}` };
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

  pipeline.push({ $sort: { trainingDate: -1, 'nominees.name': 1 } });

  const rows = await Training.aggregate(pipeline);

  return rows.map((r) => ({
    training_name: r.name,
    training_date: r.trainingDate,
    end_date: r.endDate || null,
    category: r.category,
    employee_name: r.nominees.name,
    employee_number: r.nominees.employeeNumber,
    department: r.nominees.department,
    division: r.nominees.division,
    section: r.nominees.section,
    station_region: r.nominees.stationRegion,
    attendance_status: r.nominees.attendanceStatus,
    employee_confirmed: !!r.nominees.employeeConfirmed,
  }));
}

// Department-level breakdown — nominee_count and attendee_count per department, so the
// frontend can compute both participation (who's sending people) and no-show rate
// (who's sending people who then don't show) in one call. Deliberately ignores the
// `department` filter itself, since this endpoint's whole purpose is the breakdown.
async function buildDepartmentStats({ month, category, name } = {}) {
  const trainingMatch = {};
  if (month) trainingMatch.trainingDate = { $regex: `^${escapeRegex(month)}` };
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
        nominee_count: { $sum: 1 },
        attendee_count: {
          $sum: { $cond: [{ $eq: ['$nominees.attendanceStatus', 'Attended'] }, 1, 0] },
        },
      },
    },
    { $sort: { nominee_count: -1 } },
  ]);

  return rows.map((r) => ({
    department: r._id,
    nominee_count: r.nominee_count,
    attendee_count: r.attendee_count,
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
    { header: 'End Date', key: 'end_date', width: 15 },
    { header: 'Venue', key: 'venue', width: 20 },
    { header: 'Nominees', key: 'nominee_count', width: 10 },
    { header: 'Attendees', key: 'attendee_count', width: 10 },
    { header: 'Absentees', key: 'absentee_count', width: 10 },
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
      end_date: r.end_date || '',
      venue: r.venue,
      nominee_count: r.nominee_count,
      attendee_count: r.attendee_count,
      absentee_count: r.absentee_count,
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
    { header: 'End Date', key: 'end_date', width: 15 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Employee Name', key: 'employee_name', width: 24 },
    { header: 'Employee Number', key: 'employee_number', width: 16 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Division', key: 'division', width: 18 },
    { header: 'Section', key: 'section', width: 16 },
    { header: 'Station/Region', key: 'station_region', width: 16 },
    { header: 'Attendance Status', key: 'attendance_status', width: 16 },
    { header: 'Self-Confirmed', key: 'confirmed_label', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((r) => {
    sheet.addRow({
      training_name: r.training_name,
      training_date: r.training_date,
      end_date: r.end_date || '',
      category: r.category,
      employee_name: r.employee_name,
      employee_number: r.employee_number,
      department: r.department,
      division: r.division,
      section: r.section,
      station_region: r.station_region,
      attendance_status: r.attendance_status,
      confirmed_label: r.employee_confirmed ? 'Yes' : 'No',
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