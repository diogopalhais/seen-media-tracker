import { CaretRight, CheckCircle, PlayCircle } from '@phosphor-icons/react';
import { computeProgress, type EpisodeWatch, formatEpisode, type Season } from '@seen/shared';
import { useNavigate } from 'react-router';
import { cn } from '../lib/cn.js';
import { useSeasonQuery } from '../lib/queries.js';

export function ProgressBar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} of ${max} episodes`}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-fill', className)}
    >
      <div
        className="h-full rounded-full bg-tint transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export interface ContinueWatchingCardProps {
  tmdbId: number;
  seasons: Season[];
  watches: EpisodeWatch[];
  /** Route prefix of the series screen the season routes hang off (e.g. `/library/<id>` or `/search/tv/<tmdbId>`). */
  basePath: string;
}

/** "Next up" pointer with overall progress; hidden until at least one episode has been marked. */
export function ContinueWatchingCard({
  tmdbId,
  seasons,
  watches,
  basePath,
}: ContinueWatchingCardProps) {
  const navigate = useNavigate();
  const progress = computeProgress(seasons, watches);
  const next = progress.nextUp;
  const season = useSeasonQuery(next ? tmdbId : undefined, next?.seasonNumber);
  if (watches.length === 0 || progress.total === 0) return null;
  const nextName = next
    ? season.data?.episodes.find((e) => e.episodeNumber === next.episodeNumber)?.name
    : undefined;
  const target = next
    ? `${basePath}/season/${next.seasonNumber}`
    : `${basePath}/season/${progress.lastWatched?.seasonNumber ?? 1}`;

  return (
    <section className="safe-x mt-5" aria-label="Continue watching">
      <button
        type="button"
        onClick={() => navigate(target)}
        className="card pressable flex w-full items-center gap-3 px-4 py-3 text-left"
        data-testid="continue-watching"
      >
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            progress.complete
              ? 'bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success'
              : 'bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] text-tint',
          )}
        >
          {progress.complete ? (
            <CheckCircle weight="fill" className="size-6" aria-hidden="true" />
          ) : (
            <PlayCircle weight="fill" className="size-6" aria-hidden="true" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-footnote font-semibold uppercase tracking-[0.05em] text-label-secondary">
            {progress.complete ? 'All caught up' : 'Next up'}
          </span>
          {next ? (
            <span className="truncate text-body font-semibold text-label">
              {formatEpisode(next)}
              {nextName ? (
                <span className="font-normal text-label-secondary"> · {nextName}</span>
              ) : null}
            </span>
          ) : (
            <span className="text-body font-semibold text-label">You've watched every episode</span>
          )}
          <ProgressBar value={progress.watched} max={progress.total} />
          <span className="text-caption1 tabular-nums text-label-secondary">
            {progress.watched} of {progress.total} episodes
          </span>
        </span>
        <CaretRight
          weight="bold"
          className="size-4 shrink-0 text-label-tertiary"
          aria-hidden="true"
        />
      </button>
    </section>
  );
}

export function SeasonProgressHeader({ watched, total }: { watched: number; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex flex-col gap-1" data-testid="season-progress">
      <ProgressBar value={watched} max={total} />
      <span className="text-caption1 tabular-nums text-label-secondary">
        {watched} of {total} watched
      </span>
    </div>
  );
}
