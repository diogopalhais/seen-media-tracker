import { FilmSlate, ImageBroken, Star, Television } from '@phosphor-icons/react';
import { type MediaType, RATING_MAX, type TmdbRating as TmdbRatingValue } from '@seen/shared';
import { useState } from 'react';
import { cn } from '../../lib/cn.js';

export function RatingBadge({
  rating,
  className,
  size = 'regular',
  tone = 'neutral',
}: {
  rating: number | null;
  className?: string;
  size?: 'regular' | 'large';
  tone?: 'neutral' | 'glass';
}) {
  if (rating === null) return null;
  return (
    <span
      role="img"
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold tabular-nums',
        tone === 'glass'
          ? 'bg-black/60 text-white backdrop-blur-md [-webkit-backdrop-filter:blur(12px)]'
          : 'border border-card-border bg-bg-grouped-secondary text-label shadow-[var(--shadow-card)]',
        size === 'large' ? 'h-8 px-3 text-subheadline' : 'h-6 px-2 text-footnote',
        className,
      )}
      aria-label={`Rated ${rating} out of ${RATING_MAX}`}
    >
      <Star
        weight="fill"
        className={cn('text-star', size === 'large' ? 'size-4' : 'size-3')}
        aria-hidden="true"
      />
      {rating}
      <span
        className={cn('font-normal', tone === 'glass' ? 'text-white/60' : 'text-label-tertiary')}
      >
        /{RATING_MAX}
      </span>
    </span>
  );
}

export function MediaTypeBadge({
  mediaType,
  className,
}: {
  mediaType: MediaType;
  className?: string;
}) {
  const Icon = mediaType === 'movie' ? FilmSlate : Television;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-card-border bg-bg-grouped-secondary px-1.5 py-[2px] text-caption1 font-semibold uppercase tracking-[0.06em] text-label-secondary',
        className,
      )}
    >
      <Icon weight="fill" className="size-3" aria-hidden="true" />
      {mediaType === 'movie' ? 'Movie' : 'TV'}
    </span>
  );
}

export interface PosterProps {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
}

/** 2:3 poster with a placeholder while loading and when TMDB has no artwork (or offline). */
export function Poster({ src, alt, className }: PosterProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  return (
    <div
      className={cn(
        'relative aspect-[2/3] overflow-hidden rounded-card bg-fill ring-1 ring-black/5 dark:ring-white/5',
        className,
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-0.5 p-1 text-center text-label-tertiary"
          role="img"
          aria-label={alt}
        >
          <ImageBroken className="size-7" aria-hidden="true" />
          <span className="line-clamp-3 text-caption2 leading-tight">{alt}</span>
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="fade-enter mx-auto flex max-w-xs flex-col items-center gap-1 px-margin py-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-fill text-label-secondary [&>svg]:size-8">
        {icon}
      </div>
      <h3 className="m-0 text-title3">{title}</h3>
      <p className="m-0 text-subheadline leading-relaxed text-label-secondary">{message}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * Wide header image that fades into the grouped background, with the children (poster row) pulled up
 * over its lower edge. If the image is missing or fails to load, children render normally.
 */
export function Backdrop({ src, children }: { src: string | null; children: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(src) && !failed;
  return (
    <>
      {show && (
        <div className="relative aspect-[16/9] max-h-56 w-full overflow-hidden bg-fill">
          <img
            src={src as string}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-grouped" />
        </div>
      )}
      <div className={cn('safe-x flex gap-4', show ? '-mt-16' : 'pt-4')}>{children}</div>
    </>
  );
}

const compactCount = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * Community (TMDB) rating: average out of 10 plus vote count. Deliberately quiet and monochrome so it
 * never competes with the owner's own star rating.
 */
export function TmdbRating({
  rating,
  className,
  showCount = true,
  size = 'regular',
}: {
  rating: TmdbRatingValue;
  className?: string;
  showCount?: boolean;
  size?: 'regular' | 'small';
}) {
  if (rating.average === null) return null;
  return (
    <span
      role="img"
      aria-label={`TMDB rating ${rating.average.toFixed(1)} out of 10 from ${rating.count} votes`}
      className={cn(
        'inline-flex items-center gap-1 tabular-nums text-label-secondary',
        size === 'small' ? 'text-caption1' : 'text-footnote',
        className,
      )}
    >
      <span className="rounded-[3px] bg-[#01b4e4] px-[4px] py-[1px] text-[0.5625rem] font-bold leading-none tracking-wide text-[#0d253f]">
        TMDB
      </span>
      <span className="font-semibold text-label">{rating.average.toFixed(1)}</span>
      {showCount && rating.count > 0 && <span>· {compactCount.format(rating.count)}</span>}
    </span>
  );
}
