import { useEffect, useState } from 'react';
import * as api from '../api/client';
import { formatDate, formatMoney } from '../utils';
import Spinner from '../components/Spinner';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function ReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getMonthlyReport(month)
      .then((data) => {
        setRows(data);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [month]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Monthly Report</h1>
      </div>

      <div className="card mb-4">
        <div className="card-body flex flex-wrap items-end gap-3">
          <div>
            <label className="form-label">Month</label>
            <input type="month" className="form-input" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <button className="btn btn-outline" onClick={() => setMonth('')}>
            Show All
          </button>
          <a className="btn btn-success ml-auto" href={api.monthlyReportExportUrl(month)}>
            <i className="bi bi-file-earmark-excel"></i>Export to Excel
          </a>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Training Name</th>
                <th>Date</th>
                <th>Venue</th>
                <th>Nominees</th>
                <th>Attendees</th>
                <th>Absentees</th>
                <th>Cost</th>
                <th>Paid/Free</th>
                <th>Per Diem</th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {!error && rows === null && (
                <tr>
                  <td colSpan={9} className="py-8 text-center">
                    <Spinner small />
                  </td>
                </tr>
              )}
              {!error && rows && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No trainings found for this period.
                  </td>
                </tr>
              )}
              {!error &&
                rows &&
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-slate-900">{r.name}</td>
                    <td>{formatDate(r.training_date)}</td>
                    <td>{r.venue || '-'}</td>
                    <td>{r.nominee_count}</td>
                    <td className="text-emerald-600">{r.attendee_count}</td>
                    <td className="text-red-600">{r.absentee_count}</td>
                    <td>{formatMoney(r.cost)}</td>
                    <td>{r.paid ? 'Paid' : 'Free'}</td>
                    <td>{r.per_diem ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
