import { CaretRight } from '@phosphor-icons/react';
import { formatEpisode, type LibraryItemSummary, todayLocalDateString } from '@seen/shared';
import { Link } from 'react-router';
import { cn } from '../lib/cn.js';
import { formatRelativeDate } from '../lib/format.js';
import { Poster } from './ui/Media.js';
import { ShelfHeader } from './ui/PosterRow.js';

/** Small pill over a poster in the grid: how many aired episodes are left, or "Soon" for an upcoming one. */
export function ReleaseBadge({
  kind,
  left,
  className,
}: {
  kind: 'new_episode' | 'upcoming';
  /** Aired, unwatched episodes when known. */
  left?: number | null;
  className?: string;
}) {
  const text = kind === 'upcoming' ? 'Soon' : left && left > 1 ? `${left} to watch` : 'New episode';
  return (
    <span
      className={cn(
        'absolute left-2 top-2 rounded-full px-2 py-0.5 text-caption2 font-semibold shadow-sm',
        kind === 'new_episode'
          ? 'bg-tint text-white'
          : 'bg-black/60 text-white backdrop-blur-md dark:bg-white/20',
        className,
      )}
    >
      {text}
    </span>
  );
}

/** Aired, unwatched episodes of a series when the count is reliable; null otherwise. */
export function episodesLeft(item: LibraryItemSummary): number | null {
  const p = item.progress;
  return p?.exact && p.behind > 0 ? p.behind : null;
}

export interface ReleaseCopy {
  /** Small coloured reference line: "Latest S1 E8 · 3 weeks ago", "S2 E10 · Cold Harbor". */
  eyebrow: string;
  /** The one thing that matters: "6 to watch", "Tomorrow", "New episode". */
  headline: string;
  /** Supporting line: "Next up S1 E3", "Airs in 4 days · next S2 E8", "You're up to date". */
  detail: string;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What a release card says. Leads with how many aired episodes are left to watch; when nothing is
 * left, with when the next one airs.
 */
export function releaseCopy(item: LibraryItemSummary, today: string): ReleaseCopy | null {
  const release = item.release;
  if (!release) return null;
  const ep = release.episode;
  const left = episodesLeft(item);
  const next = item.progress?.nextUp ?? null;
  const when = ep.airDate ? formatRelativeDate(ep.airDate, today) : null;
  if (release.kind === 'upcoming') {
    return {
      eyebrow: [formatEpisode(ep), ep.name || null].filter(Boolean).join(' · '),
      headline: left ? `${left} to watch` : when ? capitalize(when) : 'Soon',
      detail: left
        ? [when ? `Airs ${when}` : 'Airs soon', next ? `next ${formatEpisode(next)}` : null]
            .filter(Boolean)
            .join(' · ')
        : "You're up to date",
    };
  }
  return {
    eyebrow: [`Latest ${formatEpisode(ep)}`, when].filter(Boolean).join(' · '),
    headline: left ? `${left} to watch` : 'New episode',
    detail: left && next ? `Next up ${formatEpisode(next)}` : ep.name || 'Not watched yet',
  };
}

function ReleaseSection({
  title,
  subtitle,
  items,
  today,
  fresh,
}: {
  title: string;
  subtitle: string;
  items: LibraryItemSummary[];
  today: string;
  fresh: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section
      className="mb-6"
      aria-label={title}
      data-testid={fresh ? 'releases-new' : 'releases-soon'}
    >
      <ShelfHeader title={title} subtitle={subtitle} />
      <ul className="no-scrollbar m-0 flex snap-x list-none gap-3 overflow-x-auto px-margin py-0 [scroll-padding-inline:1rem] md:px-[var(--spacing-margin-wide)]">
        {items.map((item) => {
          const copy = releaseCopy(item, today) as ReleaseCopy;
          return (
            <li key={item.id} className="shrink-0 snap-start">
              <Link
                to={`/library/${item.id}`}
                className="card pressable flex w-[17rem] items-center gap-3 py-3 pl-3 pr-2 no-underline"
                data-testid="release-card"
                data-kind={fresh ? 'new_episode' : 'upcoming'}
              >
                <Poster src={item.posterUrl} alt="" className="w-14 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      'truncate text-caption1 font-semibold uppercase tracking-[0.05em]',
                      fresh ? 'text-tint' : 'text-label-secondary',
                    )}
                  >
                    {copy.eyebrow}
                  </span>
                  <span className="display truncate text-title3 leading-tight tabular-nums text-label">
                    {copy.headline}
                  </span>
                  <span className="mt-0.5 truncate text-subheadline font-semibold text-label">
                    {item.title}
                  </span>
                  <span className="truncate text-footnote text-label-secondary">{copy.detail}</span>
                </span>
                <CaretRight
                  weight="bold"
                  className="size-4 shrink-0 text-label-tertiary"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Library shelves for series with something to report: aired episodes waiting to be watched, then
 * episodes airing within two weeks. Each shelf is a row of compact cards that lead with what is
 * left to watch or when the next episode airs; both hide when empty.
 */
export function ReleasesShelf({ items, today }: { items: LibraryItemSummary[]; today?: string }) {
  const base = today ?? todayLocalDateString();
  const fresh = items.filter((i) => i.release?.kind === 'new_episode');
  const soon = items.filter((i) => i.release?.kind === 'upcoming');
  if (fresh.length === 0 && soon.length === 0) return null;
  return (
    <div data-testid="releases-shelf">
      <ReleaseSection
        title="New episodes"
        subtitle="Aired and waiting for you"
        items={fresh}
        today={base}
        fresh
      />
      <ReleaseSection
        title="Coming soon"
        subtitle="Airing in the next two weeks"
        items={soon}
        today={base}
        fresh={false}
      />
    </div>
  );
}
