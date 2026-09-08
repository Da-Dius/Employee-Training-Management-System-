import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Search,
  RotateCcw,
  BookText,
  Users,
  UserCheck,
  UserX,
  Percent,
  Wallet,
  BarChart3,
  Eye,
  Inbox,
  Building2,
  TrendingUp,
  Users2,
} from 'lucide-react';
import * as api from '../api/client';
import { CATEGORIES, formatDate } from '../utils';

function formatDateRange(start, end) {
  if (!end || end === start) return formatDate(start);
  return `${formatDate(start)} \u2013 ${formatDate(end)}`;
}
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

const RED = '#ff0613';
const BLACK = '#0A0A0A';

function formatKESShort(amount) {
  const n = Number(amount) || 0;
  return `KSh ${n.toLocaleString('en-KE')}`;
}

// Cost per completed attendance, by category — computed entirely from rows already
// fetched for the main table, no extra request needed.
function CostPerAttendeeByCategory({ rows }) {
  const byCategory = {};
  rows.forEach((r) => {
    if (!byCategory[r.category]) byCategory[r.category] = { cost: 0, attendees: 0 };
    byCategory[r.category].cost += Number(r.cost) || 0;
    byCategory[r.category].attendees += r.attendee_count;
  });
  const entries = Object.entries(byCategory)
    .map(([category, v]) => ({
      category,
      perAttendee: v.attendees > 0 ? v.cost / v.attendees : null,
      cost: v.cost,
      attendees: v.attendees,
    }))
    .sort((a, b) => (b.perAttendee || 0) - (a.perAttendee || 0));

  if (entries.length === 0) return <div className="py-6 text-center text-sm text-zinc-400">No data yet.</div>;

  const max = Math.max(...entries.map((e) => e.perAttendee || 0), 1);

  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <div key={e.category}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-700">{e.category}</span>
            <span className="text-zinc-500">
              {e.perAttendee === null ? 'No attendees yet' : `${formatKESShort(e.perAttendee)} / attendee`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${e.perAttendee ? (e.perAttendee / max) * 100 : 0}%`, backgroundColor: RED }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Attendance rate + spend, one bucket per month — only meaningful once more than one
// month is present in the currently filtered rows (i.e. no single-month filter active).
function MonthlyTrend({ rows }) {
  const byMonth = {};
  rows.forEach((r) => {
    const month = r.training_date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { cost: 0, nominees: 0, attendees: 0 };
    byMonth[month].cost += Number(r.cost) || 0;
    byMonth[month].nominees += r.nominee_count;
    byMonth[month].attendees += r.attendee_count;
  });
  const months = Object.keys(byMonth).sort();

  if (months.length < 2) {
    return (
      <div className="py-6 text-center text-sm text-zinc-400">
        Clear the Month filter to see a trend across multiple months.
      </div>
    );
  }

  const maxCost = Math.max(...months.map((m) => byMonth[m].cost), 1);

  return (
    <div className="flex items-end gap-3 overflow-x-auto pb-1">
      {months.map((m) => {
        const data = byMonth[m];
        const rate = data.nominees > 0 ? Math.round((data.attendees / data.nominees) * 100) : 0;
        const barHeight = Math.max((data.cost / maxCost) * 100, 4);
        return (
          <div key={m} className="flex min-w-[64px] flex-1 flex-col items-center gap-1.5">
            <div className="flex h-28 w-full items-end justify-center">
              <div
                className="w-8 rounded-t-md transition-all"
                style={{ height: `${barHeight}%`, backgroundColor: BLACK }}
                title={formatKESShort(data.cost)}
              />
            </div>
            <div className="text-[11px] font-semibold" style={{ color: RED }}>
              {rate}%
            </div>
            <div className="text-[10px] text-zinc-400">{m}</div>
          </div>
        );
      })}
    </div>
  );
}

// Department participation vs no-show rate — fetched separately since it needs a
// per-department aggregation the main table rows don't carry.
function DepartmentParticipation({ stats }) {
  if (stats === null) {
    return (
      <div className="flex justify-center py-6">
        <Spinner small />
      </div>
    );
  }
  if (stats.length === 0) return <div className="py-6 text-center text-sm text-zinc-400">No data yet.</div>;

  const top = stats.slice(0, 6);
  const max = Math.max(...top.map((d) => d.nominee_count), 1);

  return (
    <div className="space-y-3">
      {top.map((d) => {
        const noShowRate = d.nominee_count > 0 ? Math.round(((d.nominee_count - d.attendee_count) / d.nominee_count) * 100) : 0;
        return (
          <div key={d.department}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-700">{d.department}</span>
              <span className="text-zinc-500">
                {d.nominee_count} sent &middot;{' '}
                <span className={noShowRate > 30 ? 'font-semibold' : ''} style={noShowRate > 30 ? { color: RED } : undefined}>
                  {noShowRate}% no-show
                </span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(d.nominee_count / max) * 100}%`, backgroundColor: BLACK }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatKES(amount) {
  const n = Number(amount) || 0;
  return `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function attendanceRate(row) {
  if (!row.nominee_count) return null;
  return Math.round((row.attendee_count / row.nominee_count) * 100);
}

function attendanceStatusBadge(status) {
  if (status === 'Attended') return 'badge badge-green';
  if (status === 'Did Not Attend') return 'badge badge-red';
  return 'badge badge-slate';
}

const emptyFilters = { month: currentMonth(), category: '', department: '', name: '' };

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Counts up from 0 to `value` once on mount, formatting each intermediate frame with
// `format` (defaults to a plain integer). Skips animation for prefers-reduced-motion.
function AnimatedValue({ value, format = (n) => n, duration = 700 }) {
  const [display, setDisplay] = useState(prefersReducedMotion ? value : 0);
  const startRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }
    startRef.current = null;
    let frame;
    const step = (timestamp) => {
      if (startRef.current === null) startRef.current = timestamp;
      const progress = Math.min((timestamp - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(eased * value);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{format(display)}</>;
}

function KpiSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="card-body flex items-center justify-between gap-3">
        <div className="w-full">
          <div className="mb-2 h-3 w-20 rounded bg-slate-200" />
          <div className="h-6 w-14 rounded bg-slate-200" />
        </div>
        <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}

/*
 * Training Activity
 *
 * Lightweight, dependency-free chart. Shows Attended / Did Not Attend / Pending per
 * training. Pending means a nominee hasn't yet been explicitly marked either way.
 * Bars animate in from 0 width on mount rather than snapping straight to their value.
 */
function TrainingActivityChart({ rows }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const top = rows.slice(0, 8);
  if (top.length === 0) return null;

  return (
    <div className="space-y-6">
      {top.map((r, i) => {
        const total = Number(r.nominee_count) || 0;
        const attended = Number(r.attendee_count) || 0;
        const absent = Number(r.absentee_count) || 0;
        const pending = Math.max(total - attended - absent, 0);

        const attendedPct = total ? Math.round((attended / total) * 100) : 0;
        const absentPct = total ? Math.round((absent / total) * 100) : 0;
        const pendingPct = total ? Math.max(100 - attendedPct - absentPct, 0) : 0;

        return (
          <div
            key={r.id}
            className="animate-fade-slide-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{r.name}</span>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <span className="text-slate-500">
                  {attended}/{total} attended
                </span>
                <span className="font-semibold text-slate-700">{attendedPct}%</span>
              </div>
            </div>

            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              {attendedPct > 0 && (
                <div
                  className="h-full bg-emerald-500 transition-all duration-700 ease-out"
                  style={{ width: `${mounted ? attendedPct : 0}%` }}
                  title={`${attendedPct}% attended`}
                />
              )}
              {absentPct > 0 && (
                <div
                  className="h-full bg-red-400 transition-all duration-700 ease-out"
                  style={{ width: `${mounted ? absentPct : 0}%` }}
                  title={`${absentPct}% did not attend`}
                />
              )}
              {pendingPct > 0 && (
                <div
                  className="h-full bg-slate-300 transition-all duration-700 ease-out"
                  style={{ width: `${mounted ? pendingPct : 0}%` }}
                  title={`${pendingPct}% pending attendance`}
                />
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Attended: {attended}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Absent: {absent}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                Pending: {pending}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrainingDetailModal({ trainingId, onClose }) {
  const [training, setTraining] = useState(null);
  const [nominees, setNominees] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!trainingId) return;
    setTraining(null);
    setNominees(null);
    setError('');
    Promise.all([api.getTraining(trainingId), api.listNominees(trainingId)])
      .then(([t, n]) => {
        setTraining(t);
        setNominees(n);
      })
      .catch((e) => setError(e.message));
  }, [trainingId]);

  return (
    <Modal show={!!trainingId} onClose={onClose} title={training ? training.name : 'Training Details'} size="lg">
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {!error && !training && (
        <div className="flex justify-center py-8">
          <Spinner small />
        </div>
      )}
      {!error && training && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs text-slate-500">Category</div>
              <div className="font-medium text-slate-900">{training.category}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Training Date</div>
              <div className="font-medium text-slate-900">{formatDate(training.training_date)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Venue</div>
              <div className="font-medium text-slate-900">{training.venue || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Cost</div>
              <div className="font-medium text-slate-900">{formatKES(training.cost)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Paid/Free</div>
              <span className={training.paid ? 'badge badge-green' : 'badge badge-slate'}>
                {training.paid ? 'Paid' : 'Free'}
              </span>
            </div>
            <div>
              <div className="text-xs text-slate-500">Per Diem</div>
              <span className={training.per_diem ? 'badge badge-green' : 'badge badge-slate'}>
                {training.per_diem ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
          {training.description && (
            <div>
              <div className="text-xs text-slate-500">Description</div>
              <div className="text-sm text-slate-700">{training.description}</div>
            </div>
          )}

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-900">Nominees</div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
              <table className="table-clean">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Emp No.</th>
                    <th>Department</th>
                    <th>Division</th>
                    <th>Section</th>
                    <th>Station/Region</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {nominees && nominees.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400">
                        No nominees for this training.
                      </td>
                    </tr>
                  )}
                  {nominees &&
                    nominees.map((n) => (
                      <tr key={n.id}>
                        <td className="font-medium text-slate-900">{n.name}</td>
                        <td>{n.employee_number}</td>
                        <td>{n.department || '-'}</td>
                        <td>{n.division || '-'}</td>
                        <td>{n.section || '-'}</td>
                        <td>{n.station_region || '-'}</td>
                        <td>
                          <span className={attendanceStatusBadge(n.attendance_status)}>
                            {n.attendance_status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function ReportsPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [departmentStats, setDepartmentStats] = useState(null);
  const debounceRef = useRef(null);
  const isFirstRun = useRef(true);

  const load = useCallback(async (f) => {
    try {
      const data = await api.getMonthlyReport(f);
      setRows(data);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const loadDepartmentStats = useCallback(async (f) => {
    try {
      // department-stats deliberately ignores the department filter itself — see reports.js
      const { department, ...rest } = f;
      const data = await api.listDepartmentStats(rest);
      setDepartmentStats(data);
    } catch {
      setDepartmentStats([]);
    }
  }, []);

  useEffect(() => {
    load(filters);
    loadDepartmentStats(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load(filters);
      loadDepartmentStats(filters);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [filters, load, loadDepartmentStats]);

  const handleReset = () => setFilters({ month: '', category: '', department: '', name: '' });

  const totals =
    rows && rows.length
      ? rows.reduce(
        (acc, r) => ({
          nominees: acc.nominees + r.nominee_count,
          attendees: acc.attendees + r.attendee_count,
          absentees: acc.absentees + r.absentee_count,
          cost: acc.cost + (Number(r.cost) || 0),
        }),
        { nominees: 0, attendees: 0, absentees: 0, cost: 0 }
      )
      : { nominees: 0, attendees: 0, absentees: 0, cost: 0 };

  const overallRate = totals.nominees > 0 ? (totals.attendees / totals.nominees) * 100 : 0;

  // raw + format kept separate so AnimatedValue can count up the underlying number
  // and re-format it (with commas / % / KSh) on every animation frame.
  // Strictly alternating red/black — no colors outside the brand palette.
  const summaryCards = [
    {
      label: 'Total Trainings',
      raw: rows ? rows.length : 0,
      format: (n) => Math.round(n),
      Icon: BookText,
      color: RED,
      accentBg: 'bg-red-50',
    },
    {
      label: 'Total Nominees',
      raw: totals.nominees,
      format: (n) => Math.round(n),
      Icon: Users,
      color: BLACK,
      accentBg: 'bg-zinc-100',
    },
    {
      label: 'Total Attendees',
      raw: totals.attendees,
      format: (n) => Math.round(n),
      Icon: UserCheck,
      color: RED,
      accentBg: 'bg-red-50',
    },
    {
      label: 'Total Absentees',
      raw: totals.absentees,
      format: (n) => Math.round(n),
      Icon: UserX,
      color: BLACK,
      accentBg: 'bg-zinc-100',
    },
    {
      label: 'Attendance Rate',
      raw: overallRate,
      format: (n) => `${n.toFixed(1)}%`,
      Icon: Percent,
      color: RED,
      accentBg: 'bg-red-50',
    },
    {
      label: 'Total Training Cost',
      raw: totals.cost,
      format: (n) => formatKES(n),
      Icon: Wallet,
      color: BLACK,
      accentBg: 'bg-zinc-100',
      wide: true,
    },
  ];

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-slide-in {
          animation: fadeSlideIn 0.4s ease-out backwards;
        }
      `}</style>

      {/* Page heading */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Monthly Report</h1>
          <p className="mt-1 text-sm text-slate-500">Review training activity, attendance, and training costs.</p>
        </div>
      </div>

      {/* Filters + Export */}
      <div className="card mb-4">
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="form-label">Month</label>
              <input
                type="month"
                className="form-input"
                value={filters.month}
                onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Category</label>
              <select
                className="form-input"
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Department</label>
              <input
                type="text"
                className="form-input"
                placeholder="All Departments"
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Training Name</label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="form-input pl-8"
                  placeholder="Search training"
                  value={filters.name}
                  onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 pt-4">
            <button className="btn btn-outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" strokeWidth={2} />Reset Filters
            </button>
            <a
              className="btn btn-outline"
              href={api.monthlyAttendeeExportUrl(filters)}
              style={{ borderColor: `${RED}33`, color: RED }}
            >
              <Users2 className="h-4 w-4" strokeWidth={2} />Export Attendee List
            </a>
            <a className="btn btn-success" href={api.monthlyReportExportUrl(filters)}>
              <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />Export to Excel
            </a>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        {rows === null
          ? summaryCards.map((c) => <KpiSkeleton key={c.label} />)
          : summaryCards.map(({ label, raw, format, Icon, color, accentBg, wide }, i) => (
            <div
              key={label}
              style={{ animationDelay: `${i * 60}ms`, borderTopColor: color }}
              className="card group animate-fade-slide-in border-t-[3px]"
            >
              <div className="card-body flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 text-xs font-medium text-zinc-500">{label}</div>
                  <div className={wide ? 'whitespace-nowrap text-lg font-bold text-zinc-900' : 'text-xl font-bold text-zinc-900'}>
                    <AnimatedValue value={raw} format={format} />
                  </div>
                </div>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${accentBg}`}
                  style={{ color }}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
              </div>
            </div>
          ))}
      </div>

      {/* Training Activity */}
      {rows && rows.length > 0 && (
        <div className="card mb-6">
          <div className="card-body">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <BarChart3 className="h-[18px] w-[18px]" strokeWidth={2} />Training Activity
                </h2>
                <p className="mt-1 text-xs text-slate-500">Attendance progress for the selected training period.</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />Attended
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-400" />Absent
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />Pending
                </span>
              </div>
            </div>
            <TrainingActivityChart rows={rows} />
          </div>
        </div>
      )}

      {/* Analysis: department participation, cost per attendee, monthly trend */}
      {rows && rows.length > 0 && (
        <div className="mb-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="card border-t-[3px]" style={{ borderTopColor: BLACK }}>
            <div className="card-body">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Building2 className="h-4 w-4" strokeWidth={2} />Department Participation
              </h2>
              <p className="mb-4 text-xs text-zinc-500">Nominees sent and no-show rate, by department.</p>
              <DepartmentParticipation stats={departmentStats} />
            </div>
          </div>

          <div className="card border-t-[3px]" style={{ borderTopColor: RED }}>
            <div className="card-body">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Wallet className="h-4 w-4" strokeWidth={2} />Cost per Attendee
              </h2>
              <p className="mb-4 text-xs text-zinc-500">Training spend divided by actual attendees, by category.</p>
              <CostPerAttendeeByCategory rows={rows} />
            </div>
          </div>

          <div className="card border-t-[3px]" style={{ borderTopColor: BLACK }}>
            <div className="card-body">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <TrendingUp className="h-4 w-4" strokeWidth={2} />Monthly Trend
              </h2>
              <p className="mb-4 text-xs text-zinc-500">Attendance rate (%) and spend (bar height), by month.</p>
              <MonthlyTrend rows={rows} />
            </div>
          </div>
        </div>
      )}

      {/* Report table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Training Name</th>
                <th>Category</th>
                <th>Date</th>
                <th>Venue</th>
                <th className="text-center">Nominees</th>
                <th className="text-center">Attendees</th>
                <th className="text-center">Absentees</th>
                <th className="text-center">Attendance Rate</th>
                <th>Cost</th>
                <th>Paid/Free</th>
                <th>Per Diem</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {!error && rows === null && (
                <tr>
                  <td colSpan={12} className="py-8 text-center">
                    <Spinner small />
                  </td>
                </tr>
              )}
              {!error &&
                rows &&
                rows.map((r) => {
                  const rate = attendanceRate(r);
                  return (
                    <tr key={r.id}>
                      <td className="font-medium text-slate-900">{r.name}</td>
                      <td>{r.category}</td>
                      <td>{formatDateRange(r.training_date, r.end_date)}</td>
                      <td>{r.venue || '-'}</td>
                      <td className="text-center">{r.nominee_count}</td>
                      <td className="text-center font-medium text-emerald-600">{r.attendee_count}</td>
                      <td className="text-center font-medium text-red-600">{r.absentee_count}</td>
                      <td className="text-center">
                        {rate === null ? (
                          '-'
                        ) : (
                          <span className={rate === 100 ? 'badge badge-green' : rate === 0 ? 'badge badge-red' : 'badge badge-slate'}>
                            {rate}%
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{formatKES(r.cost)}</td>
                      <td>
                        <span className={r.paid ? 'badge badge-green' : 'badge badge-slate'}>{r.paid ? 'Paid' : 'Free'}</span>
                      </td>
                      <td>
                        <span className={r.per_diem ? 'badge badge-green' : 'badge badge-slate'}>{r.per_diem ? 'Yes' : 'No'}</span>
                      </td>
                      <td className="text-right">
                        <button className="btn btn-outline btn-icon" title="View details" onClick={() => setDetailId(r.id)}>
                          <Eye className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            {!error && rows && rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <td colSpan={4} className="text-left">Totals</td>
                  <td className="text-center">{totals.nominees}</td>
                  <td className="text-center text-emerald-700">{totals.attendees}</td>
                  <td className="text-center text-red-700">{totals.absentees}</td>
                  <td className="text-center">{overallRate.toFixed(1)}%</td>
                  <td className="whitespace-nowrap">{formatKES(totals.cost)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>

          {!error && rows && rows.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Inbox className="h-6 w-6" strokeWidth={2} />
              </span>
              <div>
                <div className="font-medium text-slate-700">No training records found</div>
                <div className="mt-1 text-sm text-slate-500">There are no training activities matching the selected filters.</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" strokeWidth={2} />Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      <TrainingDetailModal trainingId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}