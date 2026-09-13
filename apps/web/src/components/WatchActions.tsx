import { CheckCircle, Plus, Star } from '@phosphor-icons/react';
import {
  type LibraryItemDetail,
  todayLocalDateString,
  type WatchMutationResponse,
} from '@seen/shared';
import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { formatDate } from '../lib/format.js';
import { useLogWatchMutation, useUpdateWatchMutation } from '../lib/queries.js';
import { LogWatchSheet, type WatchTarget } from '../screens/LogWatchSheet.js';
import { Button } from './ui/Button.js';
import { RatingPicker } from './ui/RatingPicker.js';
import { Sheet } from './ui/Sheet.js';

export interface WatchActionsProps {
  target: WatchTarget;
  /** Library item detail when the title is in the library; undefined otherwise. */
  detail: LibraryItemDetail | undefined;
  /** True while the detail is still loading for a title known to be in the library. */
  loading?: boolean;
  onCreated?: (res: WatchMutationResponse) => void;
}

/**
 * The primary interaction with a title. Not watched → one-tap "Mark as Watched" (today, unrated).
 * Watched → status with date, optional Rate action or the owner's badge, and quiet secondary actions.
 */
export function WatchActions({ target, detail, loading = false, onCreated }: WatchActionsProps) {
  const logWatch = useLogWatchMutation();
  const [logOpen, setLogOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const entries = detail?.entries ?? [];
  const latest = entries[0];
  const watched = entries.length > 0;

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

  const errorMessage =
    logWatch.error instanceof ApiError
      ? logWatch.error.isOffline
        ? "You're offline. Nothing was saved."
        : logWatch.error.message
      : logWatch.error
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
            <Button
              variant="filled"
              size="large"
              className="pill flex-1"
              icon={<CheckCircle weight="fill" className="size-5" aria-hidden="true" />}
              onClick={() => setLogOpen(true)}
              aria-label="Watched. Log another watch"
            >
              Watched
            </Button>
            <Button
              variant="glass"
              size="large"
              className="pill"
              icon={
                <Star
                  weight="fill"
                  className={cn('size-5', ratedLabel && 'text-star')}
                  aria-hidden="true"
                />
              }
              onClick={() => setRateOpen(true)}
              aria-label={
                ratedLabel ? `Your rating ${detail?.rating} out of 10. Change rating` : 'Rate'
              }
            >
              {ratedLabel ?? 'Rate'}
            </Button>
          </>
        )}
      </div>
      {watched && (
        <p className="m-0 text-footnote text-label-secondary">
          {latest ? `Watched ${formatDate(latest.watchedOn)}` : 'Watched'}
          {entries.length > 1 ? ` · ${entries.length} times` : ''}
          <span className="text-label-tertiary"> · </span>
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="pressable font-medium text-label-secondary underline-offset-2 hover:underline"
          >
            Log another
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
      {latest && (
        <RateSheet
          open={rateOpen}
          onOpenChange={setRateOpen}
          entryId={latest.id}
          initial={latest.rating}
          title={target.title}
        />
      )}
    </section>
  );
}

/** Minimal sheet to set or change the rating on the most recent watch entry. */
export function RateSheet({
  open,
  onOpenChange,
  entryId,
  initial,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  initial: number | null;
  title: string;
}) {
  const update = useUpdateWatchMutation();
  const [value, setValue] = useState<number | null>(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  const save = async () => {
    try {
      await update.mutateAsync({ id: entryId, body: { rating: value } });
      onOpenChange(false);
    } catch {
      // Error shown inline.
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Rate"
      dirty={value !== initial && !update.isPending}
      trailing={
        <Button
          variant="plain"
          className="-mr-2 font-semibold"
          onClick={() => void save()}
          loading={update.isPending}
        >
          Save
        </Button>
      }
    >
      <div className="safe-x flex flex-col gap-2 pb-6 pt-2">
        <p className="m-0 truncate text-headline">{title}</p>
        <RatingPicker
          value={value}
          onChange={setValue}
          disabled={update.isPending}
          label="Your rating"
        />
        {update.isError && (
          <p role="alert" className="m-0 text-footnote text-destructive">
            {update.error instanceof ApiError ? update.error.message : 'Could not save the rating.'}
          </p>
        )}
        <Button
          variant="filled"
          size="large"
          block
          onClick={() => void save()}
          loading={update.isPending}
          className="mt-2"
        >
          Save Rating
        </Button>
      </div>
    </Sheet>
  );
}
