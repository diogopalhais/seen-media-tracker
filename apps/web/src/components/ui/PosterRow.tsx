import { CheckCircle } from '@phosphor-icons/react';
import type { SearchResult } from '@seen/shared';
import { Link } from 'react-router';
import { Poster } from './Media.js';
import { MediaCardText } from './MediaCardText.js';
import { Skeleton } from './Skeleton.js';

export interface PosterRowProps {
  title: string;
  subtitle?: string;
  items: SearchResult[] | undefined;
  /** Show the media type badge (for rows that mix movies and TV). */
  mixed?: boolean;
  loading?: boolean;
  /** Tab root the cards link under (default `/search`). */
  basePath?: string;
}

/** Shelf header: bold title and a muted one-line subtitle. Plain text, not a link. */
export function ShelfHeader({ title, subtitle }: { title: string; subtitle?: string | undefined }) {
  return (
    <div className="safe-x mb-3 flex flex-col">
      <span className="display text-title3 text-label">{title}</span>
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
  basePath = '/search',
}: PosterRowProps) {
  return (
    <section className="mt-6" aria-label={title}>
      <ShelfHeader title={title} subtitle={subtitle} />
      <ul className="no-scrollbar m-0 flex snap-x snap-mandatory gap-3 overflow-x-auto px-margin py-0 [scroll-padding-inline:1rem] md:px-[var(--spacing-margin-wide)]">
        {loading || !items
          ? Array.from({ length: 6 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
              <li key={i} className="w-40 shrink-0 snap-start" aria-hidden="true">
                <Skeleton className="aspect-[2/3] w-full rounded-card" />
                <Skeleton className="mt-2 h-3.5 w-4/5" />
                <Skeleton className="mt-1.5 h-3 w-full" />
                <Skeleton className="mt-1 h-3 w-2/3" />
              </li>
            ))
          : items.map((r) => (
              <li key={`${r.mediaType}-${r.tmdbId}`} className="w-40 shrink-0 snap-start">
                <Link
                  to={`${basePath}/${r.mediaType}/${r.tmdbId}`}
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
                  <MediaCardText
                    title={r.title}
                    titleLines={2}
                    meta={
                      r.overview ? (
                        <span className="line-clamp-2">{r.overview}</span>
                      ) : (
                        r.releaseYear
                      )
                    }
                    mediaType={r.mediaType}
                    showType={mixed}
                    tmdbRating={r.tmdbRating}
                  />
                </Link>
              </li>
            ))}
      </ul>
    </section>
  );
}
