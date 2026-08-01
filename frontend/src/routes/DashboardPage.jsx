import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookText,
  CalendarDays,
  CheckCircle2,
  Users,
  UserCheck,
  Plus,
  MapPin,
  ArrowRight,
  CalendarClock,
  History,
  BadgeCheck,
} from 'lucide-react';
import * as api from '../api/client';
import { formatDate, formatMoney } from '../utils';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

const CARD_CONFIG = [
  { key: 'totalTrainings', label: 'Total Trainings', Icon: BookText, accent: 'text-blue-600 bg-blue-50', to: '/trainings' },
  { key: 'upcomingTrainings', label: 'Upcoming Trainings', Icon: CalendarDays, accent: 'text-sky-600 bg-sky-50', to: '/trainings' },
  { key: 'completedTrainings', label: 'Completed Trainings', Icon: CheckCircle2, accent: 'text-slate-600 bg-slate-100', to: '/trainings' },
  { key: 'totalNominees', label: 'Total Nominees', Icon: Users, accent: 'text-amber-600 bg-amber-50' },
  { key: 'totalAttendees', label: 'Total Attendees', Icon: UserCheck, accent: 'text-emerald-600 bg-emerald-50' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(fullName) {
  return fullName ? fullName.trim().split(/\s+/)[0] : '';
}

function relativeDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1) return `In ${diff} days`;
  if (diff < -1) return `${Math.abs(diff)} days ago`;
  return formatDate(dateStr);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [upcoming, setUpcoming] = useState(null);
  const [recentCompleted, setRecentCompleted] = useState(null);

  useEffect(() => {
    api.getDashboard().then(setStats).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    api
      .listTrainings({})
      .then((rows) => {
        const todayStr = new Date().toISOString().slice(0, 10);

        const next = rows
          .filter((t) => t.training_date >= todayStr)
          .sort((a, b) => a.training_date.localeCompare(b.training_date))
          .slice(0, 5);
        setUpcoming(next);

        const done = rows
          .filter((t) => t.status === 'Completed')
          .sort((a, b) => b.training_date.localeCompare(a.training_date))
          .slice(0, 4);
        setRecentCompleted(done);
      })
      .catch(() => {
        setUpcoming([]);
        setRecentCompleted([]);
      });
  }, []);

  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Failed to load dashboard: {error}</div>;
  if (!stats)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );

  const confirmedRatio =
    stats.totalNominees > 0 ? Math.round((stats.totalAttendees / stats.totalNominees) * 100) : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {greeting()}
            {user?.name ? `, ${firstName(user.name)}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link to="/trainings" className="btn btn-primary">
          <Plus className="h-4 w-4" strokeWidth={2} />New Training
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {CARD_CONFIG.map(({ key, label, Icon, accent, to }) => {
          const content = (
            <div className="card-body flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
                <div className="text-3xl font-bold tracking-tight text-slate-900">{stats[key]}</div>
                {key === 'totalAttendees' && confirmedRatio !== null && (
                  <div className="mt-2 w-24">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${confirmedRatio}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">{confirmedRatio}% of nominees</div>
                  </div>
                )}
              </div>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent}`}>
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
            </div>
          );
          return to ? (
            <Link className="card transition-shadow hover:shadow-md" key={key} to={to}>
              {content}
            </Link>
          ) : (
            <div className="card" key={key}>
              {content}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Upcoming Trainings */}
        <div className="card">
          <div className="card-body">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <CalendarClock className="h-[18px] w-[18px]" strokeWidth={2} />Upcoming Trainings
              </h2>
              <Link to="/trainings" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
                View all<ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>

            {upcoming === null && (
              <div className="flex justify-center py-8">
                <Spinner small />
              </div>
            )}

            {upcoming && upcoming.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-400">
                Nothing scheduled yet.{' '}
                <Link to="/trainings" className="font-medium text-blue-600 hover:underline">
                  Create a training
                </Link>{' '}
                to see it here.
              </div>
            )}

            {upcoming && upcoming.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {upcoming.map((t, i) => (
                  <li key={t.id}>
                    <Link
                      to={`/trainings/${t.id}`}
                      className="-mx-2 flex items-center justify-between gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900">{t.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="badge badge-slate border border-slate-200">{t.category}</span>
                          {t.venue && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" strokeWidth={2} />
                              {t.venue}
                            </span>
                          )}
                          {t.cost > 0 && <span>{formatMoney(t.cost)}</span>}
                          {t.per_diem && <span className="badge badge-green">Per diem</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`text-sm font-semibold ${i === 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                          {relativeDate(t.training_date)}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">{formatDate(t.training_date)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recently Completed */}
        <div className="card">
          <div className="card-body">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <History className="h-[18px] w-[18px]" strokeWidth={2} />Recently Completed
              </h2>
              <Link to="/trainings" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
                View all<ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>

            {recentCompleted === null && (
              <div className="flex justify-center py-8">
                <Spinner small />
              </div>
            )}

            {recentCompleted && recentCompleted.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-400">No completed trainings yet.</div>
            )}

            {recentCompleted && recentCompleted.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {recentCompleted.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/trainings/${t.id}`}
                      className="-mx-2 flex items-center justify-between gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900">{t.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="badge badge-slate border border-slate-200">{t.category}</span>
                          {t.venue && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" strokeWidth={2} />
                              {t.venue}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                          <BadgeCheck className="h-4 w-4" strokeWidth={2} />
                          {relativeDate(t.training_date)}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">{formatDate(t.training_date)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}