import { CheckCircle, Clock, PlayCircle, Plus, Star } from '@phosphor-icons/react';
import {
  formatEpisode,
  type LibraryItemDetail,
  todayLocalDateString,
  type WatchMutationResponse,
} from '@seen/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { formatDate } from '../lib/format.js';
import { useLogWatchMutation, useUpdateWatchMutation } from '../lib/queries.js';
import type { SeriesStanding } from '../lib/seriesProgress.js';
import { LogWatchSheet, type WatchTarget } from '../screens/LogWatchSheet.js';
import { standingText } from './Progress.js';
import { Button } from './ui/Button.js';
import { RatingPicker } from './ui/RatingPicker.js';

export interface WatchActionsProps {
  target: WatchTarget;
  /** Library item detail when the title is in the library; undefined otherwise. */
  detail: LibraryItemDetail | undefined;
  /** True while the detail is still loading for a title known to be in the library. */
  loading?: boolean;
  onCreated?: (res: WatchMutationResponse) => void;
  /**
   * Series only: the owner's standing from ticks and logs, and the route prefix of the season
   * screens. When given, the primary button says where they are instead of whether a log exists.
   */
  series?: { standing: SeriesStanding; basePath: string } | null;
}

/**
 * The primary interaction with a title. Not watched → one-tap "Mark as Watched" (today, unrated).
 * Watched → status with date, optional Rate action or the owner's badge, and quiet secondary actions.
 * For a series the button reflects the episodes: "Continue S2 E5" when behind, "Up to date" while
 * waiting for the next episode to air, "Watched" once every episode is seen.
 */
export function WatchActions({
  target,
  detail,
  loading = false,
  onCreated,
  series = null,
}: WatchActionsProps) {
  const logWatch = useLogWatchMutation();
  const updateWatch = useUpdateWatchMutation();
  const navigate = useNavigate();
  const [logOpen, setLogOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const entries = detail?.entries ?? [];
  const latest = entries[0];
  const progress = series?.standing.progress;
  const status = progress ? progress.status : entries.length > 0 ? 'watched' : 'unwatched';
  const watched = status !== 'unwatched';
  const nextUp = progress?.nextUp ?? null;
  /** Season to open when behind: the next episode's, else the first season with something left. */
  const continueSeason =
    nextUp?.seasonNumber ??
    progress?.perSeason.find((s) => s.watchedAired < s.aired)?.seasonNumber ??
    1;

  const markWatched = async () => {
    try {
      const res = await logWatch.mutateAsync({
        mediaType: target.mediaType,
        tmdbId: target.tmdbId,
        watchedOn: todayLocalDateString(),
        rating: null,
        note: null,
        ...(target.mediaType === 'tv' ? { season: null } : {}),
      });
      onCreated?.(res);
    } catch {
      // Error surfaced below.
    }
  };

  /** Inline rating: saves on tap, then folds the strip away. */
  const rate = async (rating: number | null) => {
    if (!latest) return;
    try {
      await updateWatch.mutateAsync({ id: latest.id, body: { rating } });
      setSavedFlash(true);
      setTimeout(() => {
        setSavedFlash(false);
        setRateOpen(false);
      }, 450);
    } catch {
      // Error surfaced below.
    }
  };

  const error = logWatch.error ?? updateWatch.error;
  const errorMessage =
    error instanceof ApiError
      ? error.isOffline
        ? "You're offline. Nothing was saved."
        : error.message
      : error
        ? 'Could not save. Please try again.'
        : null;
  const ratedLabel = detail?.rating != null ? `${detail.rating}/10` : null;

  return (
    <section className="flex w-full flex-col items-center gap-2" aria-label="Watched status">
      <div className="flex w-full max-w-md items-stretch justify-center gap-2">
        {!watched ? (
          <>
            <Button
              variant="filled"
              size="large"
              className="pill flex-1"
              loading={logWatch.isPending || loading}
              icon={<CheckCircle weight="bold" className="size-5" aria-hidden="true" />}
              onClick={() => void markWatched()}
            >
              Mark Watched
            </Button>
            <Button
              variant="glass"
              size="large"
              className="pill"
              aria-label="Log with details"
              icon={<Plus weight="bold" className="size-5" aria-hidden="true" />}
              onClick={() => setLogOpen(true)}
            >
              Log
            </Button>
          </>
        ) : (
          <>
            {status === 'behind' && series ? (
              <Button
                variant="filled"
                size="large"
                className="pill flex-1"
                icon={<PlayCircle weight="fill" className="size-5" aria-hidden="true" />}
                onClick={() => navigate(`${series.basePath}/season/${continueSeason}`)}
                aria-label={
                  nextUp
                    ? `Behind. Continue with ${formatEpisode(nextUp)}`
                    : `Behind. Continue with season ${continueSeason}`
                }
                data-status="behind"
              >
                Continue{nextUp ? ` ${formatEpisode(nextUp)}` : ''}
              </Button>
            ) : status === 'up_to_date' ? (
              <Button
                variant="filled"
                size="large"
                className="pill flex-1"
                icon={<Clock weight="fill" className="size-5" aria-hidden="true" />}
                onClick={() => setLogOpen(true)}
                aria-label="Up to date. Log a watch"
                data-status="up_to_date"
              >
                Up to date
              </Button>
            ) : (
              <Button
                variant="filled"
                size="large"
                className="pill flex-1"
                icon={<CheckCircle weight="fill" className="size-5" aria-hidden="true" />}
                onClick={() => setLogOpen(true)}
                aria-label="Watched. Log another watch"
                data-status="watched"
              >
                Watched
              </Button>
            )}
            {entries.length > 0 ? (
              <Button
                variant="glass"
                size="large"
                className={cn('pill', rateOpen && 'ring-2 ring-tint/40')}
                icon={
                  <Star
                    weight="fill"
                    className={cn('size-5', ratedLabel && 'text-star')}
                    aria-hidden="true"
                  />
                }
                onClick={() => setRateOpen((o) => !o)}
                aria-expanded={rateOpen}
                aria-controls="inline-rating"
                aria-label={
                  ratedLabel ? `Your rating ${detail?.rating} out of 10. Change rating` : 'Rate'
                }
              >
                {ratedLabel ?? 'Rate'}
              </Button>
            ) : (
              <Button
                variant="glass"
                size="large"
                className="pill"
                aria-label="Log with details"
                icon={<Plus weight="bold" className="size-5" aria-hidden="true" />}
                onClick={() => setLogOpen(true)}
              >
                Log
              </Button>
            )}
          </>
        )}
      </div>

      {watched && entries.length > 0 && (
        <div id="inline-rating" className="disclosure w-full max-w-md" data-open={rateOpen}>
          <div>
            <div className="glass mt-1 flex flex-col items-center gap-1 rounded-[1.25rem] px-3 py-3 shadow-none">
              <RatingPicker
                compact
                label="Your rating"
                value={detail?.rating ?? null}
                onChange={(v) => void rate(v)}
                disabled={updateWatch.isPending}
              />
              <span className="text-caption1 text-label-tertiary" aria-live="polite">
                {updateWatch.isPending ? 'Saving…' : savedFlash ? 'Saved' : 'Tap a number to rate'}
              </span>
            </div>
          </div>
        </div>
      )}

      {watched && (
        <p className="m-0 text-footnote text-label-secondary" data-testid="watch-standing">
          {series && progress
            ? status === 'watched' && latest
              ? `Watched ${formatDate(latest.watchedOn)} · ${progress.total} episodes`
              : standingText(series.standing)
            : `${latest ? `Watched ${formatDate(latest.watchedOn)}` : 'Watched'}${
                entries.length > 1 ? ` · ${entries.length} times` : ''
              }`}
          <span className="text-label-tertiary"> · </span>
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="pressable font-medium text-label-secondary underline-offset-2 hover:underline"
          >
            {entries.length > 0 ? 'Log another' : 'Log a watch'}
          </button>
        </p>
      )}
      {errorMessage && (
        <p role="alert" className="m-0 text-footnote text-destructive">
          {errorMessage}
        </p>
      )}

      <LogWatchSheet
        open={logOpen}
        onOpenChange={setLogOpen}
        mode={{ kind: 'create' }}
        target={target}
        onSaved={onCreated}
      />
    </section>
  );
}
