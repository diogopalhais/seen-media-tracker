import {
  type AiredEpisode,
  type Company,
  formatEpisode,
  type MediaType,
  type PersonCredit,
  todayLocalDateString,
} from '@seen/shared';
import { formatDate, formatRelativeDate, formatStatus } from '../lib/format.js';
import { InsetGroupedList } from './ui/InsetGroupedList.js';

export interface TitleDetailsListProps {
  mediaType: MediaType;
  status: string | null;
  lastEpisodeToAir?: AiredEpisode | null | undefined;
  nextEpisodeToAir?: AiredEpisode | null | undefined;
  networks?: Company[] | undefined;
  productionCompanies?: Company[] | undefined;
  crew?: PersonCredit[] | undefined;
  releaseDate?: string | null | undefined;
  /** Injected by tests; defaults to the device's local date. */
  today?: string | undefined;
}

interface DetailRow {
  key: string;
  label: string;
  value: string;
}

function episodeLine(prefix: string, ep: AiredEpisode, today: string): string {
  return [
    prefix,
    formatEpisode(ep),
    ep.name || null,
    ep.airDate ? formatRelativeDate(ep.airDate, today) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Jobs that read naturally in the plural; combined jobs ("Director, Screenplay") and others stay as-is. */
const PLURAL_JOBS: Record<string, string> = {
  Director: 'Directors',
  Writer: 'Writers',
  Creator: 'Creators',
};

/** Groups crew by their (possibly combined) job: "Director" → names, "Creator" → names. */
function crewRows(crew: PersonCredit[]): DetailRow[] {
  const byRole = new Map<string, string[]>();
  for (const p of crew) {
    const role = p.role || 'Crew';
    const names = byRole.get(role) ?? [];
    if (!names.includes(p.name)) names.push(p.name);
    byRole.set(role, names);
  }
  return [...byRole.entries()].map(([role, names]) => ({
    key: `crew-${role}`,
    label: names.length > 1 ? (PLURAL_JOBS[role] ?? role) : role,
    value: names.join(', '),
  }));
}

export function buildDetailRows(p: TitleDetailsListProps): DetailRow[] {
  const today = p.today ?? todayLocalDateString();
  const rows: DetailRow[] = [];
  const status = formatStatus(p.status);
  if (p.mediaType === 'tv') {
    const next = p.nextEpisodeToAir;
    const last = p.lastEpisodeToAir;
    const value = next
      ? episodeLine('Next', next, today)
      : last
        ? episodeLine('Latest', last, today)
        : null;
    if (status || value) {
      rows.push({
        key: 'status',
        label: 'Status',
        value: [status, value].filter(Boolean).join(' · '),
      });
    }
  } else if (status && p.status !== 'Released') {
    rows.push({
      key: 'status',
      label: 'Status',
      value: p.releaseDate ? `${status} · ${formatDate(p.releaseDate)}` : status,
    });
  }
  if (p.networks && p.networks.length > 0) {
    rows.push({
      key: 'network',
      label: p.networks.length > 1 ? 'Networks' : 'Network',
      value: p.networks.map((n) => n.name).join(', '),
    });
  }
  if (p.productionCompanies && p.productionCompanies.length > 0) {
    rows.push({
      key: 'studio',
      label: p.productionCompanies.length > 1 ? 'Studios' : 'Studio',
      value: p.productionCompanies.map((c) => c.name).join(', '),
    });
  }
  if (p.crew) rows.push(...crewRows(p.crew));
  return rows;
}

/** Status and next episode, network, studio, director or creator, as an inset list of label/value rows. */
export function TitleDetailsList(p: TitleDetailsListProps) {
  const rows = buildDetailRows(p);
  if (rows.length === 0) return null;
  return (
    <InsetGroupedList header="Details" className="mt-5">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-0.5 px-4 py-2.5">
          <span className="text-caption1 font-medium uppercase tracking-[0.06em] text-label-tertiary">
            {row.label}
          </span>
          <span className="text-body leading-snug text-label">{row.value}</span>
        </li>
      ))}
    </InsetGroupedList>
  );
}
