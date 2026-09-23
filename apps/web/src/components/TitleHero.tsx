import { type MediaType, RATING_MAX, type TmdbRating } from '@seen/shared';
import { type ReactNode, useState } from 'react';
import { cn } from '../lib/cn.js';
import { formatRuntime, formatSeasons } from '../lib/format.js';
import { mediaKind } from '../lib/mediaKinds.js';
import { Backdrop, Poster } from './ui/Media.js';

export interface TitleHeroProps {
  title: string;
  originalTitle?: string;
  mediaType: MediaType;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  numberOfSeasons: number | null;
  genres: { id: number; name: string }[];
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  tmdbRating: TmdbRating;
  ownerRating: number | null;
  /** Games: platforms, shown in the meta line where movies show runtime. */
  platforms?: { name: string }[] | undefined;
  /** Pill actions rendered under the meta line. */
  actions?: ReactNode;
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

/**
 * Hero header for a movie or series: ambient artwork, centred poster with deep shadow, centred
 * title and meta, glass genre chips, pill actions, synopsis with "Show more", then a stats row.
 */
export function TitleHero(p: TitleHeroProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = [
    p.releaseYear,
    p.mediaType === 'movie'
      ? formatRuntime(p.runtimeMinutes)
      : p.mediaType === 'tv'
        ? formatSeasons(p.numberOfSeasons)
        : p.platforms?.map((x) => x.name).join(', '),
    mediaKind(p.mediaType).label,
  ]
    .filter(Boolean)
    .join(' · ');
  const stats: { label: string; value: string }[] = [];
  if (p.tmdbRating.average !== null)
    stats.push({ label: 'People', value: p.tmdbRating.average.toFixed(1) });
  if (p.tmdbRating.count > 0)
    stats.push({ label: 'Votes', value: compact.format(p.tmdbRating.count) });
  if (p.ownerRating !== null) stats.push({ label: 'You', value: `${p.ownerRating}/${RATING_MAX}` });
  const long = p.overview.length > 220;

  return (
    <div className="pb-2">
      <Backdrop src={p.backdropUrl} ambientSrc={p.posterUrl} layout="hero">
        <div className="flex w-full flex-col items-center text-center">
          <Poster
            src={p.posterUrl}
            alt={p.title}
            className="w-36 shadow-[var(--shadow-poster)] sm:w-40"
          />
          <h2 className="display m-0 mt-5 text-title1 leading-tight text-label">{p.title}</h2>
          {p.originalTitle && p.originalTitle !== p.title && (
            <p className="m-0 mt-0.5 text-footnote text-label-secondary">{p.originalTitle}</p>
          )}
          <p className="m-0 mt-1 text-footnote text-label-secondary">{meta}</p>
          {p.genres.length > 0 && (
            <ul className="m-0 mt-3 flex list-none flex-wrap justify-center gap-1.5 p-0">
              {p.genres.map((g) => (
                <li
                  key={g.id}
                  className="glass rounded-full px-3 py-1 text-caption1 font-medium text-label-secondary shadow-none"
                >
                  {g.name}
                </li>
              ))}
            </ul>
          )}
          {p.actions && <div className="mt-5 flex w-full justify-center">{p.actions}</div>}
        </div>
      </Backdrop>

      {p.overview && (
        <div className="safe-x mt-5">
          <p
            className={cn(
              'm-0 text-callout leading-relaxed text-label',
              !expanded && long && 'line-clamp-4',
            )}
          >
            {p.overview}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="hit-target pressable -ml-1 px-1 text-subheadline font-medium text-label-secondary"
              aria-expanded={expanded}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {stats.length > 0 && (
        <dl className="safe-x m-0 mt-4 flex gap-6">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col">
              <dt className="text-caption1 font-medium uppercase tracking-[0.06em] text-label-tertiary">
                {s.label}
              </dt>
              <dd className="display m-0 text-title3 tabular-nums text-label">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
