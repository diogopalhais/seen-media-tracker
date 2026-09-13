import type { MediaType, TmdbRating } from '@seen/shared';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';
import { AudienceRating, MediaTypeBadge, RatingBadge } from './Media.js';

export interface MediaCardTextProps {
  title: string;
  /** Second line: year plus optional progress or description. */
  meta?: ReactNode;
  mediaType?: MediaType;
  showType?: boolean;
  tmdbRating?: TmdbRating;
  ownerRating?: number | null;
  titleLines?: 1 | 2;
  className?: string;
}

/**
 * The one text recipe under posters and beside thumbnails: title (body, semibold), a meta line, and a
 * separate ratings line with people's rating first and the owner's star second.
 */
export function MediaCardText({
  title,
  meta,
  mediaType,
  showType = false,
  tmdbRating,
  ownerRating = null,
  titleLines = 2,
  className,
}: MediaCardTextProps) {
  const hasRatings =
    (tmdbRating && tmdbRating.average !== null) || ownerRating !== null || (showType && mediaType);
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <span
        className={cn(
          'text-body font-semibold leading-snug text-label',
          titleLines === 1 ? 'line-clamp-1' : 'line-clamp-2',
        )}
      >
        {title}
      </span>
      {meta && (
        <span className="mt-0.5 text-footnote leading-snug text-label-secondary">{meta}</span>
      )}
      {hasRatings && (
        <span className="mt-2 flex flex-wrap items-center gap-2">
          {showType && mediaType && <MediaTypeBadge mediaType={mediaType} />}
          {tmdbRating && <AudienceRating rating={tmdbRating} size="small" showCount={false} />}
          <RatingBadge rating={ownerRating} />
        </span>
      )}
    </div>
  );
}
