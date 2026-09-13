import { CheckCircle } from '@phosphor-icons/react';
import type { SearchResult } from '@seen/shared';
import { Link } from 'react-router';
import { AudienceRating, MediaTypeBadge, Poster } from './Media.js';
import { Skeleton } from './Skeleton.js';

export interface PosterRowProps {
  title: string;
  items: SearchResult[] | undefined;
  /** Show the media type badge (for rows that mix movies and TV). */
  mixed?: boolean;
  loading?: boolean;
}

/** Horizontally scrolling poster cards with snap points, HIG "shelf" style. */
export function PosterRow({ title, items, mixed = false, loading = false }: PosterRowProps) {
  return (
    <section className="mt-5" aria-label={title}>
      <h3 className="display safe-x m-0 mb-2 text-title3">{title}</h3>
      <ul className="no-scrollbar m-0 flex snap-x snap-mandatory gap-3 overflow-x-auto px-margin py-0 [scroll-padding-inline:1rem] md:px-[var(--spacing-margin-wide)]">
        {loading || !items
          ? Array.from({ length: 6 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
              <li key={i} className="w-[7.25rem] shrink-0 snap-start" aria-hidden="true">
                <Skeleton className="aspect-[2/3] w-full rounded-card" />
                <Skeleton className="mt-2 h-3.5 w-4/5" />
                <Skeleton className="mt-1.5 h-3 w-1/2" />
              </li>
            ))
          : items.map((r) => (
              <li key={`${r.mediaType}-${r.tmdbId}`} className="w-[7.25rem] shrink-0 snap-start">
                <Link
                  to={`/search/${r.mediaType}/${r.tmdbId}`}
                  className="pressable poster-hover flex flex-col gap-1.5 rounded-card no-underline"
                >
                  <div className="relative">
                    <Poster
                      src={r.posterUrl}
                      alt={r.title}
                      className="shadow-[var(--shadow-poster)]"
                    />
                    {r.inLibrary && (
                      <span
                        className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-success backdrop-blur-md"
                        role="img"
                        aria-label="Seen"
                      >
                        <CheckCircle weight="fill" className="size-4" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <span className="line-clamp-2 text-footnote font-semibold leading-snug text-label">
                    {r.title}
                  </span>
                  <span className="-mt-1 flex flex-wrap items-center gap-1 text-caption1 text-label-secondary">
                    {r.releaseYear && <span>{r.releaseYear}</span>}
                    {mixed && <MediaTypeBadge mediaType={r.mediaType} />}
                  </span>
                  <AudienceRating
                    rating={r.tmdbRating}
                    size="small"
                    showCount={false}
                    className="-mt-1"
                  />
                </Link>
              </li>
            ))}
      </ul>
    </section>
  );
}
