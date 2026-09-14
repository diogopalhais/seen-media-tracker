import { formatEpisode, type LibraryItemSummary, todayLocalDateString } from '@seen/shared';
import { Link } from 'react-router';
import { cn } from '../lib/cn.js';
import { formatRelativeDate } from '../lib/format.js';
import { Poster } from './ui/Media.js';
import { MediaCardText } from './ui/MediaCardText.js';
import { ShelfHeader } from './ui/PosterRow.js';

/** Small pill over a poster: "New episode" for an aired, unwatched episode; "Soon" for an upcoming one. */
export function ReleaseBadge({
  kind,
  className,
}: {
  kind: 'new_episode' | 'upcoming';
  className?: string;
}) {
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
      {kind === 'new_episode' ? 'New episode' : 'Soon'}
    </span>
  );
}

/** Library shelf of series with a new or upcoming episode; hidden when there is nothing to report. */
export function ReleasesShelf({ items, today }: { items: LibraryItemSummary[]; today?: string }) {
  const alerts = items.filter((i) => i.release !== null);
  if (alerts.length === 0) return null;
  const base = today ?? todayLocalDateString();
  return (
    <section className="mb-6" aria-label="New and upcoming episodes" data-testid="releases-shelf">
      <ShelfHeader
        title="New & upcoming"
        subtitle="Episodes you have not seen yet, and what airs next"
      />
      <ul className="no-scrollbar m-0 flex snap-x list-none gap-3 overflow-x-auto px-margin py-0 [scroll-padding-inline:1rem] md:px-[var(--spacing-margin-wide)]">
        {alerts.map((item) => {
          const release = item.release as NonNullable<LibraryItemSummary['release']>;
          const ep = release.episode;
          return (
            <li key={item.id} className="w-32 shrink-0 snap-start">
              <Link
                to={`/library/${item.id}`}
                className="pressable poster-hover flex flex-col gap-1.5 rounded-card no-underline"
              >
                <div className="relative">
                  <Poster
                    src={item.posterUrl}
                    alt={item.title}
                    className="shadow-[var(--shadow-poster)]"
                  />
                  <ReleaseBadge kind={release.kind} />
                </div>
                <MediaCardText
                  title={item.title}
                  titleLines={1}
                  meta={[
                    formatEpisode(ep),
                    ep.airDate ? formatRelativeDate(ep.airDate, base) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
