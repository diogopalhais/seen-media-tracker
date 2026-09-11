import { CheckCircle, Star } from '@phosphor-icons/react';
import {
  type LibraryItemDetail,
  todayLocalDateString,
  type WatchMutationResponse,
} from '@seen/shared';
import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { useLogWatchMutation, useUpdateWatchMutation } from '../lib/queries.js';
import { LogWatchSheet, type WatchTarget } from '../screens/LogWatchSheet.js';
import { Button } from './ui/Button.js';
import { RatingBadge } from './ui/Media.js';
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

  return (
    <section className="safe-x mt-5" aria-label="Watched status">
      {!watched ? (
        <div className="flex flex-col items-stretch gap-2">
          <Button
            variant="filled"
            size="large"
            block
            loading={logWatch.isPending || loading}
            icon={<CheckCircle weight="fill" className="size-5" aria-hidden="true" />}
            onClick={() => void markWatched()}
          >
            Mark as Watched
          </Button>
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="hit-target pressable self-center text-subheadline font-medium text-tint"
          >
            Log with details
          </button>
        </div>
      ) : (
        <div className="card flex flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success">
              <CheckCircle weight="fill" className="size-6" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-headline text-label">Watched</span>
              <span className="text-footnote text-label-secondary">
                {latest ? formatDate(latest.watchedOn) : ''}
                {entries.length > 1 ? ` · ${entries.length} times` : ''}
              </span>
            </div>
            {detail?.rating != null ? (
              <button
                type="button"
                onClick={() => setRateOpen(true)}
                aria-label={`Your rating ${detail.rating} out of 10. Change rating`}
                className="hit-target pressable"
              >
                <RatingBadge rating={detail.rating} size="large" />
              </button>
            ) : (
              <Button
                variant="tinted"
                onClick={() => setRateOpen(true)}
                icon={<Star weight="fill" className="size-4" aria-hidden="true" />}
                className="h-9"
              >
                Rate
              </Button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="hit-target pressable self-start text-footnote font-medium text-label-secondary"
          >
            Log another watch
          </button>
        </div>
      )}
      {errorMessage && (
        <p role="alert" className="m-0 mt-2 text-footnote text-destructive">
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
