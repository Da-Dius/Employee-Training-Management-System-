export const CATEGORIES = ['Technical', 'Leadership', 'Compliance', 'ICT', 'Soft Skills', 'Other'];

export function formatMoney(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d + 'T00:00:00');
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Ranges collapse to a single date when there's no end date, or when the end equals the
// start — a one-day training entered as 12th-to-12th should read like every other
// one-day training, not "12 Mar 2026 – 12 Mar 2026".
export function formatDateRange(start, end) {
  if (!start) return formatDate(end);
  if (!end || end === start) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function statusBadgeClass(status) {
  return status === 'Upcoming' ? 'badge badge-blue' : 'badge badge-slate';
}

export function attendanceBadgeClass(status) {
  if (status === 'Attended') return 'badge badge-green';
  if (status === 'Did Not Attend') return 'badge badge-red';
  // Slate, not amber: this now matches the fallback the Reports and Attendance pages
  // were already using in their own local copies of this function, which this replaces.
  return 'badge badge-slate';
}

// The nomination is a separate axis from attendance — someone can have accepted and
// still not shown up. Amber for Pending because it means "waiting on someone".
export function nominationBadgeClass(status) {
  if (status === 'Accepted') return 'badge badge-green';
  if (status === 'Declined') return 'badge badge-red';
  return 'badge badge-amber';
}
