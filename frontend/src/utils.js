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

export function statusBadgeClass(status) {
  return status === 'Upcoming' ? 'badge badge-blue' : 'badge badge-slate';
}

export function attendanceBadgeClass(status) {
  if (status === 'Attended') return 'badge badge-green';
  if (status === 'Did Not Attend') return 'badge badge-red';
  return 'badge badge-amber';
}
