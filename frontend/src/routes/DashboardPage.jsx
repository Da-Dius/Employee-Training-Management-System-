import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/client';
import Spinner from '../components/Spinner';

const CARD_CONFIG = [
  { key: 'totalTrainings', label: 'Total Trainings', icon: 'bi-journal-text', accent: 'text-blue-600 bg-blue-50' },
  { key: 'upcomingTrainings', label: 'Upcoming Trainings', icon: 'bi-calendar-event', accent: 'text-sky-600 bg-sky-50' },
  { key: 'completedTrainings', label: 'Completed Trainings', icon: 'bi-check-circle', accent: 'text-slate-600 bg-slate-100' },
  { key: 'totalNominees', label: 'Total Nominees', icon: 'bi-people', accent: 'text-amber-600 bg-amber-50' },
  { key: 'totalAttendees', label: 'Total Attendees', icon: 'bi-person-check', accent: 'text-emerald-600 bg-emerald-50' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboard().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Failed to load dashboard: {error}</div>;
  if (!stats)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <Link to="/trainings" className="btn btn-primary">
          <i className="bi bi-plus-lg"></i>New Training
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {CARD_CONFIG.map((c) => (
          <div className="card" key={c.key}>
            <div className="card-body flex items-center justify-between gap-3">
              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">{c.label}</div>
                <div className="text-2xl font-bold text-slate-900">{stats[c.key]}</div>
              </div>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${c.accent}`}>
                <i className={`bi ${c.icon}`}></i>
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
