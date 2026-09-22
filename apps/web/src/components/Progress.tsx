import { CaretRight, CheckCircle, Clock, PlayCircle } from '@phosphor-icons/react';
import { formatEpisode, todayLocalDateString } from '@seen/shared';
import { useNavigate } from 'react-router';
import { cn } from '../lib/cn.js';
import { formatRelativeDate } from '../lib/format.js';
import { useSeasonQuery } from '../lib/queries.js';
import type { SeriesStanding } from '../lib/seriesProgress.js';

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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "S2 E8 airs tomorrow", or a waiting message when the provider has no date yet. */
export function nextToAirText(standing: SeriesStanding, today = todayLocalDateString()): string {
  const next = standing.nextToAir;
  if (!next) return 'Waiting for the next episode';
  const when = next.airDate ? ` airs ${formatRelativeDate(next.airDate, today)}` : ' coming soon';
  return `${formatEpisode(next)}${when}`;
}

/**
 * One-line standing for a series, shared by the watch button and the card:
 * "3 episodes behind · 12 of 15 aired", "S2 E8 airs tomorrow · 15 of 18 episodes aired", ...
 */
export function standingText(standing: SeriesStanding, today = todayLocalDateString()): string {
  const p = standing.progress;
  switch (p.status) {
    case 'behind':
      if (standing.loading) return 'Checking where you are…';
      if (!p.exact) return 'New episodes since your last log';
      return `${plural(p.behind, 'episode')} behind · ${p.watchedAired} of ${p.aired} aired`;
    case 'up_to_date':
      return p.remaining > 0
        ? `${nextToAirText(standing, today)} · ${p.aired} of ${p.total} episodes aired`
        : nextToAirText(standing, today);
    case 'watched':
      return `All ${plural(p.total, 'episode')} watched`;
    default:
      return '';
  }
}

export interface ContinueWatchingCardProps {
  tmdbId: number;
  standing: SeriesStanding;
  /** Route prefix of the series screen the season routes hang off (e.g. `/library/<id>` or `/search/tv/<tmdbId>`). */
  basePath: string;
}

/**
 * Where the owner stands: the next aired episode to watch, "up to date" while waiting for the next
 * one to air, or "all caught up" once the series is fully watched. Hidden until something is logged.
 */
export function ContinueWatchingCard({ tmdbId, standing, basePath }: ContinueWatchingCardProps) {
  const navigate = useNavigate();
  const progress = standing.progress;
  const next = progress.nextUp;
  const season = useSeasonQuery(next ? tmdbId : undefined, next?.seasonNumber);
  if (progress.status === 'unwatched' || progress.total === 0) return null;
  const nextName = next
    ? season.data?.episodes.find((e) => e.episodeNumber === next.episodeNumber)?.name
    : undefined;
  const target = `${basePath}/season/${
    next?.seasonNumber ?? progress.lastWatched?.seasonNumber ?? 1
  }`;
  const status = progress.status;
  const tone =
    status === 'behind'
      ? 'bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] text-tint'
      : 'bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success';
  const label =
    status === 'behind' ? 'Next up' : status === 'up_to_date' ? 'Up to date' : 'All caught up';
  const barValue = status === 'watched' ? progress.total : progress.watchedAired;
  const barMax = status === 'watched' ? progress.total : progress.aired;
  const counter =
    status === 'watched'
      ? `${progress.total} of ${progress.total} episodes`
      : standing.loading
        ? 'Checking where you are…'
        : status === 'behind' && !progress.exact
          ? `${progress.aired} aired · new since your last log`
          : `${progress.watchedAired} of ${progress.aired} aired${
              progress.behind > 0 ? ` · ${progress.behind} behind` : ''
            }${progress.remaining > 0 ? ` · ${progress.remaining} to come` : ''}`;

  return (
    <section className="safe-x mt-5" aria-label="Continue watching">
      <button
        type="button"
        onClick={() => navigate(target)}
        className="card pressable flex w-full items-center gap-3 px-4 py-3 text-left"
        data-testid="continue-watching"
        data-status={status}
      >
        <span
          className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', tone)}
        >
          {status === 'behind' ? (
            <PlayCircle weight="fill" className="size-6" aria-hidden="true" />
          ) : status === 'up_to_date' ? (
            <Clock weight="fill" className="size-6" aria-hidden="true" />
          ) : (
            <CheckCircle weight="fill" className="size-6" aria-hidden="true" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-footnote font-semibold uppercase tracking-[0.05em] text-label-secondary">
            {label}
          </span>
          {status === 'behind' && next ? (
            <span className="truncate text-body font-semibold text-label">
              {formatEpisode(next)}
              {nextName ? (
                <span className="font-normal text-label-secondary"> · {nextName}</span>
              ) : null}
            </span>
          ) : status === 'up_to_date' ? (
            <span className="truncate text-body font-semibold text-label">
              {nextToAirText(standing)}
            </span>
          ) : (
            <span className="text-body font-semibold text-label">You've watched every episode</span>
          )}
          <ProgressBar value={barValue} max={barMax} />
          <span className="text-caption1 tabular-nums text-label-secondary">{counter}</span>
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

export function SeasonProgressHeader({
  watched,
  total,
  unaired = 0,
}: {
  watched: number;
  /** Aired episodes of the season. */
  total: number;
  /** Episodes listed but not aired yet. */
  unaired?: number;
}) {
  if (total === 0) return null;
  return (
    <div className="flex flex-col gap-1" data-testid="season-progress">
      <ProgressBar value={watched} max={total} />
      <span className="text-caption1 tabular-nums text-label-secondary">
        {watched} of {total} {unaired > 0 ? 'aired ' : ''}watched
        {unaired > 0 ? ` · ${unaired} not aired yet` : ''}
      </span>
    </div>
  );
}
