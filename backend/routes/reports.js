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

// GET /api/reports/monthly?month=2026-07
// SQL used correlated subqueries per training row to get nominee/attendee/absentee counts.
// The Mongo equivalent is a single aggregation pipeline: $lookup joins each training to its
// nominees, then $filter + $size compute the three counts in the same pass.
async function buildMonthlyReport(month) {
  const match = {};
  if (month) {
    // training_date is stored as a plain 'YYYY-MM-DD' string, so a prefix match on 'YYYY-MM'
    // does the same job strftime('%Y-%m', ...) did in SQLite.
    match.trainingDate = { $regex: `^${escapeRegex(month)}` };
  }

  const rows = await Training.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'nominees',
        localField: '_id',
        foreignField: 'training',
        as: 'nominees',
      },
    },
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
    { $sort: { trainingDate: -1 } },
  ]);

  return rows.map((r) => ({
    id: r._id,
    name: r.name,
    category: r.category,
    training_date: r.trainingDate,
    venue: r.venue,
    nominee_count: r.nominee_count,
    attendee_count: r.attendee_count,
    absentee_count: r.absentee_count,
    cost: r.cost,
    paid: !!r.paid,
    per_diem: !!r.perDiem,
  }));
}

router.get('/monthly', asyncHandler(async (req, res) => {
  const rows = await buildMonthlyReport(req.query.month);
  res.json(rows);
}));

router.get('/monthly/export', asyncHandler(async (req, res) => {
  const rows = await buildMonthlyReport(req.query.month);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Monthly Report');

  sheet.columns = [
    { header: 'Training Name', key: 'name', width: 30 },
    { header: 'Training Date', key: 'training_date', width: 15 },
    { header: 'Venue', key: 'venue', width: 20 },
    { header: 'Nominees', key: 'nominee_count', width: 10 },
    { header: 'Attendees', key: 'attendee_count', width: 10 },
    { header: 'Absentees', key: 'absentee_count', width: 10 },
    { header: 'Cost of Training', key: 'cost', width: 15 },
    { header: 'Paid or Free', key: 'paid_label', width: 12 },
    { header: 'Per Diem', key: 'per_diem_label', width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((r) => {
    sheet.addRow({
      name: r.name,
      training_date: r.training_date,
      venue: r.venue,
      nominee_count: r.nominee_count,
      attendee_count: r.attendee_count,
      absentee_count: r.absentee_count,
      cost: r.cost,
      paid_label: r.paid ? 'Paid' : 'Free',
      per_diem_label: r.per_diem ? 'Yes' : 'No',
    });
  });

  const monthLabel = req.query.month || 'all';
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="training-report-${monthLabel}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
}));

module.exports = router;