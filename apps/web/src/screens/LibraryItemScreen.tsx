import { ArrowSquareOut, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import type { WatchEntry } from '@seen/shared';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { SeasonsList } from '../components/SeasonsList.js';
import { AlertDialog } from '../components/ui/AlertDialog.js';
import { Banner } from '../components/ui/Banner.js';
import { Button } from '../components/ui/Button.js';
import { InsetGroupedList, Row } from '../components/ui/InsetGroupedList.js';
import {
  Backdrop,
  EmptyState,
  MediaTypeBadge,
  Poster,
  RatingBadge,
  TmdbRating,
} from '../components/ui/Media.js';
import { Screen } from '../components/ui/NavBar.js';
import { ListSkeleton, Skeleton } from '../components/ui/Skeleton.js';
import { ApiError } from '../lib/api.js';
import { formatDate, formatRuntime, formatSeasons, seasonLabel } from '../lib/format.js';
import { useBack } from '../lib/nav.js';
import { useDeleteWatchMutation, useLibraryItemQuery, useTitleQuery } from '../lib/queries.js';
import { LogWatchSheet, type SheetMode } from './LogWatchSheet.js';

export function LibraryItemScreen() {
  const { itemId } = useParams<{ itemId: string }>();
  const back = useBack('/library');
  const navigate = useNavigate();
  const query = useLibraryItemQuery(itemId);
  const deleteWatch = useDeleteWatchMutation();
  const [sheet, setSheet] = useState<{ open: boolean; mode: SheetMode }>({
    open: false,
    mode: { kind: 'create' },
  });
  const [pendingDelete, setPendingDelete] = useState<WatchEntry | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const detail = query.data;
  const item = detail?.item;
  // Seasons are not part of the snapshot; fetch them live and degrade silently if TMDB is unavailable.
  const title = useTitleQuery(
    item?.mediaType === 'tv' ? 'tv' : undefined,
    item?.mediaType === 'tv' ? item.tmdbId : undefined,
  );

  const confirmDelete = async () => {
    if (!pendingDelete || !item) return;
    const wasLast = (detail?.entries.length ?? 0) <= 1;
    try {
      await deleteWatch.mutateAsync({
        id: pendingDelete.id,
        item: { id: item.id, mediaType: item.mediaType, tmdbId: item.tmdbId },
      });
      setPendingDelete(null);
      if (wasLast) navigate('/library', { replace: true });
    } catch (err) {
      setPendingDelete(null);
      setDeleteError(err instanceof ApiError ? err.message : 'Could not delete this watch.');
    }
  };

  if (query.isPending) {
    return (
      <Screen title=" " onBack={back} backLabel="Library" animate>
        <div className="safe-x flex gap-2 py-2">
          <Skeleton className="aspect-[2/3] w-28 rounded-card" />
          <div className="flex flex-1 flex-col gap-1 pt-1">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <ListSkeleton rows={3} />
      </Screen>
    );
  }

  if (query.isError || !detail || !item) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Screen title="Not Available" onBack={back} backLabel="Library" animate>
        <EmptyState
          icon={<Trash />}
          title={notFound ? 'This title is no longer in your library' : "Couldn't load this title"}
          message={
            notFound
              ? 'All of its watches were removed.'
              : ((query.error as Error | null)?.message ?? 'Please try again.')
          }
          action={
            notFound ? (
              <Button variant="tinted" onClick={() => navigate('/library', { replace: true })}>
                Back to Library
              </Button>
            ) : (
              <Button variant="tinted" onClick={() => void query.refetch()}>
                Retry
              </Button>
            )
          }
        />
      </Screen>
    );
  }

  const meta = [
    item.releaseYear,
    formatRuntime(item.runtimeMinutes),
    formatSeasons(item.numberOfSeasons),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen title={item.title} onBack={back} backLabel="Library" animate>
      <Backdrop src={item.backdropUrl}>
        <Poster
          src={item.posterUrl}
          alt={item.title}
          className="w-28 shrink-0 shadow-[var(--shadow-poster)]"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-end gap-0.5 pb-1">
          <h2 className="m-0 text-title2 leading-tight">{item.title}</h2>
          {item.originalTitle !== item.title && (
            <p className="m-0 text-footnote text-label-secondary">{item.originalTitle}</p>
          )}
          <p className="m-0 flex flex-wrap items-center gap-1 text-footnote text-label-secondary">
            <MediaTypeBadge mediaType={item.mediaType} />
            {meta && <span>{meta}</span>}
          </p>
          <TmdbRating rating={item.tmdbRating} />
          <div className="mt-0.5 flex items-center gap-1">
            <RatingBadge rating={detail.rating} size="large" />
            <span className="text-subheadline text-label-secondary">
              {detail.watchCount === 1 ? 'Watched once' : `Watched ${detail.watchCount} times`}
            </span>
          </div>
        </div>
      </Backdrop>

      {item.genres.length > 0 && (
        <ul className="safe-x m-0 mt-4 flex list-none flex-wrap gap-1.5 py-0">
          {item.genres.map((g) => (
            <li
              key={g.id}
              className="rounded-full bg-fill px-1 py-[2px] text-caption1 text-label-secondary"
            >
              {g.name}
            </li>
          ))}
        </ul>
      )}

      {item.overview && (
        <p className="safe-x m-0 mt-4 text-callout leading-relaxed text-label">{item.overview}</p>
      )}

      <div className="safe-x mt-5">
        <Button
          variant="filled"
          size="large"
          block
          icon={<Plus weight="bold" className="size-5" aria-hidden="true" />}
          onClick={() => setSheet({ open: true, mode: { kind: 'create' } })}
        >
          Log Another Watch
        </Button>
      </div>

      {deleteError && (
        <Banner tone="error" onDismiss={() => setDeleteError(null)}>
          {deleteError}
        </Banner>
      )}

      {item.mediaType === 'tv' && title.data?.seasons && (
        <SeasonsList seasons={title.data.seasons} basePath={`/library/${item.id}`} />
      )}

      <InsetGroupedList header="History" className="mt-3">
        {detail.entries.map((entry) => (
          <li key={entry.id}>
            <div className="flex min-h-[3.25rem] items-center gap-1 pl-4 pr-2 py-1">
              <div className="flex min-w-0 flex-1 flex-col py-1.5">
                <span className="flex flex-wrap items-center gap-2 text-body font-medium">
                  <time dateTime={entry.watchedOn}>{formatDate(entry.watchedOn)}</time>
                  {item.mediaType === 'tv' && entry.season !== null && (
                    <span className="text-footnote text-label-secondary">
                      {seasonLabel(entry.season)}
                    </span>
                  )}
                  <RatingBadge rating={entry.rating} />
                </span>
                {entry.note && (
                  <span className="whitespace-pre-wrap text-footnote text-label-secondary">
                    {entry.note}
                  </span>
                )}
              </div>
              <button
                type="button"
                aria-label={`Edit watch on ${formatDate(entry.watchedOn)}`}
                onClick={() => setSheet({ open: true, mode: { kind: 'edit', entry } })}
                className="hit-target pressable flex items-center justify-center text-tint"
              >
                <PencilSimple className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Delete watch on ${formatDate(entry.watchedOn)}`}
                onClick={() => setPendingDelete(entry)}
                className="hit-target pressable flex items-center justify-center text-destructive"
              >
                <Trash className="size-5" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </InsetGroupedList>

      <InsetGroupedList>
        <Row
          label="View on TMDB"
          href={item.tmdbUrl}
          external
          icon={<ArrowSquareOut className="size-5" aria-hidden="true" />}
        />
      </InsetGroupedList>

      <LogWatchSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        mode={sheet.mode}
        target={{
          mediaType: item.mediaType,
          tmdbId: item.tmdbId,
          title: item.title,
          releaseYear: item.releaseYear,
          seasons: null,
          numberOfSeasons: item.numberOfSeasons,
        }}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this watch?"
        description={
          (detail.entries.length ?? 0) <= 1
            ? 'This is the only watch for this title, so it will be removed from your library.'
            : 'This watch entry will be permanently removed.'
        }
        confirmLabel="Delete"
        destructive
        loading={deleteWatch.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </Screen>
  );
}
