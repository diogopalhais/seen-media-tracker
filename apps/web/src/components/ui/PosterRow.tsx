import { CaretRight, CheckCircle } from '@phosphor-icons/react';
import type { SearchResult } from '@seen/shared';
import { Link } from 'react-router';
import { AudienceRating, MediaTypeBadge, Poster } from './Media.js';
import { Skeleton } from './Skeleton.js';

export interface PosterRowProps {
  title: string;
  subtitle?: string;
  items: SearchResult[] | undefined;
  /** Show the media type badge (for rows that mix movies and TV). */
  mixed?: boolean;
  loading?: boolean;
}

/** Shelf header: bold title with a chevron and a muted one-line subtitle. */
export function ShelfHeader({ title, subtitle }: { title: string; subtitle?: string | undefined }) {
  return (
    <div className="safe-x mb-3 flex flex-col">
      <span className="display inline-flex items-center gap-1 text-title3 text-label">
        {title}
        <CaretRight weight="bold" className="size-4 text-label-tertiary" aria-hidden="true" />
      </span>
      {subtitle && <span className="text-footnote text-label-secondary">{subtitle}</span>}
    </div>
  );
}

/** Horizontally scrolling poster cards with snap points; each card carries title and a short description. */
export function PosterRow({
  title,
  subtitle,
  items,
  mixed = false,
  loading = false,
}: PosterRowProps) {
  return (
    <section className="mt-6" aria-label={title}>
      <ShelfHeader title={title} subtitle={subtitle} />
      <ul className="no-scrollbar m-0 flex snap-x snap-mandatory gap-3 overflow-x-auto px-margin py-0 [scroll-padding-inline:1rem] md:px-[var(--spacing-margin-wide)]">
        {loading || !items
          ? Array.from({ length: 6 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
              <li key={i} className="w-36 shrink-0 snap-start" aria-hidden="true">
                <Skeleton className="aspect-[2/3] w-full rounded-card" />
                <Skeleton className="mt-2 h-3.5 w-4/5" />
                <Skeleton className="mt-1.5 h-3 w-full" />
                <Skeleton className="mt-1 h-3 w-2/3" />
              </li>
            ))
          : items.map((r) => (
              <li key={`${r.mediaType}-${r.tmdbId}`} className="w-36 shrink-0 snap-start">
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
                        className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-success backdrop-blur-md"
                        role="img"
                        aria-label="Seen"
                      >
                        <CheckCircle weight="fill" className="size-4" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <span className="line-clamp-1 text-subheadline font-semibold text-label">
                    {r.title}
                  </span>
                  {r.overview ? (
                    <span className="-mt-1 line-clamp-2 text-caption1 leading-snug text-label-secondary">
                      {r.overview}
                    </span>
                  ) : (
                    <span className="-mt-1 text-caption1 text-label-secondary">
                      {r.releaseYear ?? ''}
                    </span>
                  )}
                  <span className="-mt-0.5 flex flex-wrap items-center gap-1.5 text-caption1 text-label-secondary">
                    {mixed && <MediaTypeBadge mediaType={r.mediaType} />}
                    <AudienceRating rating={r.tmdbRating} size="small" showCount={false} />
                  </span>
                </Link>
              </li>
            ))}
      </ul>
    </section>
  );
}
