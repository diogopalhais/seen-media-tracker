export function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
}

export function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`;
}

export function formatSeasons(n: number | null): string | null {
  if (!n) return null;
  return n === 1 ? '1 season' : `${n} seasons`;
}

export function seasonLabel(season: number | null): string {
  if (season === null) return 'Whole series';
  return season === 0 ? 'Specials' : `Season ${season}`;
}

/** Provider status labels, lightly humanised ("Returning Series" → "Returning"). */
export function formatStatus(status: string | null): string | null {
  if (!status) return null;
  if (status === 'Returning Series') return 'Returning';
  if (status === 'In Production') return 'In production';
  if (status === 'Post Production') return 'Post-production';
  return status;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(isoDate: string): number | null {
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : Math.round(d.getTime() / DAY_MS);
}

/** "today", "tomorrow", "in 5 days", "3 days ago" within two weeks; a medium date beyond that. */
export function formatRelativeDate(isoDate: string, today: string): string {
  const target = dayNumber(isoDate);
  const base = dayNumber(today);
  if (target === null || base === null) return formatDate(isoDate);
  const diff = target - base;
  if (Math.abs(diff) >= 14) return formatDate(isoDate);
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(diff, 'day');
}
