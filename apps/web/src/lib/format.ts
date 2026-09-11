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
