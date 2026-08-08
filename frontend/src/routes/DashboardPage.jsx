import { useEffect, useRef, useState } from 'react';
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
import { formatDate } from '../utils';
import { useAuth } from '../context/AuthContext';

const RED = '#ff0613';
const BLACK = '#0A0A0A';

// Strictly alternating red/black — no colors outside the brand palette.
const CARD_CONFIG = [
  {
    key: 'totalTrainings',
    label: 'Total Trainings',
    Icon: BookText,
    color: RED,
    accentBg: 'bg-red-50',
    to: '/trainings',
  },
  {
    key: 'upcomingTrainings',
    label: 'Upcoming Trainings',
    Icon: CalendarDays,
    color: BLACK,
    accentBg: 'bg-zinc-100',
    to: '/trainings',
  },
  {
    key: 'completedTrainings',
    label: 'Completed Trainings',
    Icon: CheckCircle2,
    color: RED,
    accentBg: 'bg-red-50',
    to: '/trainings',
  },
  {
    key: 'totalNominees',
    label: 'Total Nominees',
    Icon: Users,
    color: BLACK,
    accentBg: 'bg-zinc-100',
  },
  {
    key: 'totalAttendees',
    label: 'Total Attendees',
    Icon: UserCheck,
    color: RED,
    accentBg: 'bg-red-50',
  },
];

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function formatKES(amount) {
  const n = Number(amount) || 0;
  return `KSh ${n.toLocaleString('en-KE')}`;
}

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

function AnimatedNumber({ value, duration = 700 }) {
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
      setDisplay(Math.round(eased * value));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{display}</>;
}

function TrainingRow({ t, tone, index }) {
  const toneColor = tone === 'upcoming' ? RED : BLACK;

  return (
    <Link
      to={`/trainings/${t.id}`}
      style={{ animationDelay: `${index * 60}ms` }}
      className="animate-fade-slide-in group flex h-full flex-col justify-between rounded-lg border border-zinc-100 p-3 transition-colors hover:border-zinc-200 hover:bg-zinc-50"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-zinc-900">{t.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
          <span className="badge badge-slate border border-zinc-200">{t.category}</span>
          {t.venue && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" strokeWidth={2} />
              {t.venue}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 font-semibold" style={{ color: toneColor }}>
          {tone === 'completed' && <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} />}
          {relativeDate(t.training_date)}
        </span>
        <span className="text-zinc-400">{formatDate(t.training_date)}</span>
      </div>
      {tone === 'upcoming' && t.cost > 0 && <div className="mt-1 text-xs text-zinc-400">{formatKES(t.cost)}</div>}
    </Link>
  );
}

function KpiSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="card-body flex items-center justify-between gap-3">
        <div className="w-full">
          <div className="mb-2 h-3 w-20 rounded bg-zinc-200" />
          <div className="h-8 w-12 rounded bg-zinc-200" />
        </div>
        <div className="h-10 w-10 shrink-0 rounded-lg bg-zinc-200" />
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="animate-pulse rounded-lg border border-zinc-100 p-3">
          <div className="mb-2 h-4 w-2/3 rounded bg-zinc-200" />
          <div className="h-3 w-1/3 rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [upcoming, setUpcoming] = useState(null);
  const [recentCompleted, setRecentCompleted] = useState(null);
  const [ratioMounted, setRatioMounted] = useState(false);

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
          .slice(0, 4);
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

  useEffect(() => {
    if (stats) {
      const t = setTimeout(() => setRatioMounted(true), 50);
      return () => clearTimeout(t);
    }
  }, [stats]);

  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Failed to load dashboard: {error}</div>;

  const confirmedRatio =
    stats && stats.totalNominees > 0 ? Math.round((stats.totalAttendees / stats.totalNominees) * 100) : null;

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

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            {greeting()}
            {user?.name ? `, ${firstName(user.name)}` : ''}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link to="/trainings" className="btn btn-primary">
          <Plus className="h-4 w-4" strokeWidth={2} />New Training
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {!stats
          ? CARD_CONFIG.map(({ key }) => <KpiSkeleton key={key} />)
          : CARD_CONFIG.map(({ key, label, Icon, color, accentBg, to }, i) => {
            const content = (
              <div className="card-body flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 text-xs font-medium text-zinc-500">{label}</div>
                  <div className="text-3xl font-bold tracking-tight text-zinc-900">
                    <AnimatedNumber value={stats[key]} />
                  </div>
                  {key === 'totalAttendees' && confirmedRatio !== null && (
                    <div className="mt-2 w-24">
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${ratioMounted ? confirmedRatio : 0}%`, backgroundColor: BLACK }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-400">{confirmedRatio}% of nominees</div>
                    </div>
                  )}
                </div>
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${accentBg}`}
                  style={{ color }}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
              </div>
            );
            const commonProps = {
              key,
              style: { animationDelay: `${i * 60}ms`, borderTopColor: color },
              className: `card group animate-fade-slide-in border-t-[3px] ${to ? 'card-hover' : ''}`,
            };
            return to ? (
              <Link to={to} {...commonProps}>
                {content}
              </Link>
            ) : (
              <div {...commonProps}>{content}</div>
            );
          })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Upcoming Trainings — red */}
        <div className="card border-t-[3px]" style={{ borderTopColor: RED }}>
          <div className="card-body">
            <div className="section-heading">
              <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <CalendarClock className="h-[18px] w-[18px]" strokeWidth={2} />Upcoming Trainings
              </h2>
              <Link to="/trainings" className="inline-flex items-center gap-1 text-sm font-medium hover:underline" style={{ color: RED }}>
                View all<ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>

            {upcoming === null && <PanelSkeleton />}

            {upcoming && upcoming.length === 0 && (
              <div className="py-8 text-center text-sm text-zinc-400">
                Nothing scheduled yet.{' '}
                <Link to="/trainings" className="font-medium hover:underline" style={{ color: RED }}>
                  Create a training
                </Link>{' '}
                to see it here.
              </div>
            )}

            {upcoming && upcoming.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {upcoming.map((t, i) => (
                  <TrainingRow key={t.id} t={t} tone="upcoming" index={i} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recently Completed — black */}
        <div className="card border-t-[3px]" style={{ borderTopColor: BLACK }}>
          <div className="card-body">
            <div className="section-heading">
              <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <History className="h-[18px] w-[18px]" strokeWidth={2} />Recently Completed
              </h2>
              <Link to="/trainings" className="inline-flex items-center gap-1 text-sm font-medium hover:underline" style={{ color: RED }}>
                View all<ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>

            {recentCompleted === null && <PanelSkeleton />}

            {recentCompleted && recentCompleted.length === 0 && (
              <div className="py-8 text-center text-sm text-zinc-400">No completed trainings yet.</div>
            )}

            {recentCompleted && recentCompleted.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {recentCompleted.map((t, i) => (
                  <TrainingRow key={t.id} t={t} tone="completed" index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}