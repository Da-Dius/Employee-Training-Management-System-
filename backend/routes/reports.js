const express = require('express');
const ExcelJS = require('exceljs');
const { Training } = require('../db/database');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) =>
    fn(req, res, next).catch(next);
}

function escapeRegex(str) {
  return str.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

/*
 * Build the monthly training report.
 *
 * Training-level filters:
 * - month
 * - category
 * - training name
 *
 * Nominee-level filter:
 * - department
 *
 * Department is stored on the Nominee document,
 * therefore it is applied after the nominees lookup.
 */
async function buildMonthlyReport({
  month,
  category,
  department,
  name,
} = {}) {
  const match = {};

  /*
   * trainingDate is stored as YYYY-MM-DD.
   * A prefix match on YYYY-MM allows us to
   * filter by month.
   */
  if (month) {
    match.trainingDate = {
      $regex: `^${escapeRegex(month)}`,
    };
  }

  if (category) {
    match.category = category;
  }

  if (name) {
    match.name = {
      $regex: escapeRegex(name),
      $options: 'i',
    };
  }

  const pipeline = [
    {
      $match: match,
    },

    /*
     * Attach nominees belonging to each training.
     */
    {
      $lookup: {
        from: 'nominees',
        localField: '_id',
        foreignField: 'training',
        as: 'nominees',
      },
    },
  ];

  /*
   * Department belongs to nominees rather
   * than the training itself.
   */
  if (department) {
    pipeline.push({
      $match: {
        'nominees.department': {
          $regex: escapeRegex(department),
          $options: 'i',
        },
      },
    });
  }

  pipeline.push(
    {
      $addFields: {
        /*
         * Total number of nominees.
         */
        nominee_count: {
          $size: '$nominees',
        },

        /*
         * Explicitly marked as Attended.
         */
        attendee_count: {
          $size: {
            $filter: {
              input: '$nominees',
              as: 'n',
              cond: {
                $eq: [
                  '$$n.attendanceStatus',
                  'Attended',
                ],
              },
            },
          },
        },

        /*
         * Explicitly marked as Did Not Attend.
         */
        absentee_count: {
          $size: {
            $filter: {
              input: '$nominees',
              as: 'n',
              cond: {
                $eq: [
                  '$$n.attendanceStatus',
                  'Did Not Attend',
                ],
              },
            },
          },
        },
      },
    },

    /*
     * Most recent training first.
     */
    {
      $sort: {
        trainingDate: -1,
      },
    }
  );

  const rows =
    await Training.aggregate(pipeline);

  /*
   * Return the API structure expected by
   * ReportsPage.jsx.
   */
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

/*
 * GET /api/reports/monthly
 *
 * Example:
 *
 * /api/reports/monthly
 * ?month=2026-07
 * &category=Technical
 * &department=Finance
 * &name=digital
 */
router.get(
  '/monthly',
  asyncHandler(async (req, res) => {
    const {
      month,
      category,
      department,
      name,
    } = req.query;

    const rows =
      await buildMonthlyReport({
        month,
        category,
        department,
        name,
      });

    res.json(rows);
  })
);

/*
 * GET /api/reports/monthly/export
 *
 * Generates an Excel version of the same
 * filtered monthly report.
 */
router.get(
  '/monthly/export',
  asyncHandler(async (req, res) => {
    const {
      month,
      category,
      department,
      name,
    } = req.query;

    const rows =
      await buildMonthlyReport({
        month,
        category,
        department,
        name,
      });

    const workbook =
      new ExcelJS.Workbook();

    const sheet =
      workbook.addWorksheet(
        'Monthly Report'
      );

    /*
     * Excel columns.
     */
    sheet.columns = [
      {
        header: 'Training Name',
        key: 'name',
        width: 30,
      },

      {
        header: 'Category',
        key: 'category',
        width: 16,
      },

      {
        header: 'Training Date',
        key: 'training_date',
        width: 15,
      },

      {
        header: 'Venue',
        key: 'venue',
        width: 20,
      },

      {
        header: 'Nominees',
        key: 'nominee_count',
        width: 10,
      },

      {
        header: 'Attendees',
        key: 'attendee_count',
        width: 10,
      },

      {
        header: 'Absentees',
        key: 'absentee_count',
        width: 10,
      },

      {
        header: 'Attendance Rate',
        key: 'attendance_rate',
        width: 14,
      },

      {
        header: 'Cost of Training',
        key: 'cost',
        width: 15,
      },

      {
        header: 'Paid or Free',
        key: 'paid_label',
        width: 12,
      },

      {
        header: 'Per Diem',
        key: 'per_diem_label',
        width: 10,
      },
    ];

    /*
     * Format Excel header.
     */
    sheet.getRow(1).font = {
      bold: true,
    };

    /*
     * Add report rows.
     */
    rows.forEach((r) => {
      sheet.addRow({
        name: r.name,

        category: r.category,

        training_date:
          r.training_date,

        venue: r.venue,

        nominee_count:
          r.nominee_count,

        attendee_count:
          r.attendee_count,

        absentee_count:
          r.absentee_count,

        attendance_rate:
          r.nominee_count > 0
            ? `${Math.round(
              (r.attendee_count /
                r.nominee_count) *
              100
            )}%`
            : '-',

        cost: r.cost,

        paid_label: r.paid
          ? 'Paid'
          : 'Free',

        per_diem_label: r.per_diem
          ? 'Yes'
          : 'No',
      });
    });

    /*
     * Filename.
     */
    const monthLabel =
      month || 'all';

    /*
     * Tell browser this is an Excel file.
     */
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="training-report-${monthLabel}.xlsx"`
    );

    /*
     * Write workbook directly to response.
     */
    await workbook.xlsx.write(res);

    res.end();
  })
);

module.exports = router;