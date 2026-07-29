const express = require('express');
const ExcelJS = require('exceljs');
const { db } = require('../db/database');

const router = express.Router();

// GET /api/reports/monthly?month=2026-07
function buildMonthlyReport(month) {
  let sql = `
    SELECT t.*,
      (SELECT COUNT(*) FROM nominees n WHERE n.training_id = t.id) AS nominee_count,
      (SELECT COUNT(*) FROM nominees n WHERE n.training_id = t.id AND n.attendance_status = 'Attended') AS attendee_count,
      (SELECT COUNT(*) FROM nominees n WHERE n.training_id = t.id AND n.attendance_status = 'Did Not Attend') AS absentee_count
    FROM trainings t
  `;
  const params = [];
  if (month) {
    sql += " WHERE strftime('%Y-%m', t.training_date) = ?";
    params.push(month);
  }
  sql += ' ORDER BY t.training_date DESC';

  return db.prepare(sql).all(...params);
}

router.get('/monthly', (req, res) => {
  const rows = buildMonthlyReport(req.query.month);
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      training_date: r.training_date,
      venue: r.venue,
      nominee_count: r.nominee_count,
      attendee_count: r.attendee_count,
      absentee_count: r.absentee_count,
      cost: r.cost,
      paid: !!r.paid,
      per_diem: !!r.per_diem,
    }))
  );
});

router.get('/monthly/export', async (req, res) => {
  const rows = buildMonthlyReport(req.query.month);

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
});

module.exports = router;
