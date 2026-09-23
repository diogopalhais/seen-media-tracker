import { ArrowSquareOut, PencilSimple, Trash } from '@phosphor-icons/react';
import { formatPlaytime, todayLocalDateString, type WatchEntry } from '@seen/shared';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CastRow } from '../components/CastRow.js';
import { FollowRow } from '../components/FollowRow.js';
import { ContinueWatchingCard } from '../components/Progress.js';
import { SeasonsList } from '../components/SeasonsList.js';
import { TitleDetailsList } from '../components/TitleDetailsList.js';
import { TitleHero } from '../components/TitleHero.js';
import { AlertDialog } from '../components/ui/AlertDialog.js';
import { Banner } from '../components/ui/Banner.js';
import { Button } from '../components/ui/Button.js';
import { InsetGroupedList, Row } from '../components/ui/InsetGroupedList.js';
import { EmptyState, RatingBadge } from '../components/ui/Media.js';
import { Screen } from '../components/ui/NavBar.js';
import { ListSkeleton, Skeleton } from '../components/ui/Skeleton.js';
import { WatchActions } from '../components/WatchActions.js';
import { ApiError } from '../lib/api.js';
import { formatDate, formatRelativeDate, seasonLabel } from '../lib/format.js';
import { useBack } from '../lib/nav.js';
import { useDeleteWatchMutation, useLibraryItemQuery, useTitleQuery } from '../lib/queries.js';
import { useSeriesStanding } from '../lib/seriesProgress.js';
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
  // Seasons, cast and companies are not part of the snapshot; fetch them live and degrade silently
  // to the stored status and episodes if TMDB is unavailable.
  const title = useTitleQuery(item?.mediaType, item?.tmdbId);
  const standing = useSeriesStanding({
    tmdbId: item?.tmdbId,
    seasons: item?.mediaType === 'tv' ? title.data?.seasons : null,
    detail,
    status: title.data?.status ?? item?.status,
    lastEpisodeToAir: title.data?.lastEpisodeToAir ?? item?.lastEpisodeToAir,
    nextEpisodeToAir: title.data?.nextEpisodeToAir ?? item?.nextEpisodeToAir,
  });

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

  return (
    <Screen title={item.title} onBack={back} backLabel="Library" transparent animate>
      <TitleHero
        title={item.title}
        originalTitle={item.originalTitle}
        mediaType={item.mediaType}
        releaseYear={item.releaseYear}
        runtimeMinutes={item.runtimeMinutes}
        numberOfSeasons={item.numberOfSeasons}
        genres={item.genres}
        posterUrl={item.posterUrl}
        backdropUrl={item.backdropUrl}
        overview={item.overview}
        tmdbRating={item.tmdbRating}
        ownerRating={detail.rating}
        platforms={title.data?.platforms}
        actions={
          <WatchActions
            target={{
              mediaType: item.mediaType,
              tmdbId: item.tmdbId,
              title: item.title,
              releaseYear: item.releaseYear,
              seasons: title.data?.seasons ?? null,
              numberOfSeasons: item.numberOfSeasons,
            }}
            detail={detail}
            series={standing ? { standing, basePath: `/library/${item.id}` } : null}
          />
        }
      />

      {deleteError && (
        <Banner tone="error" onDismiss={() => setDeleteError(null)}>
          {deleteError}
        </Banner>
      )}

      {item.mediaType === 'tv' && title.data?.seasons && standing && (
        <>
          <ContinueWatchingCard
            tmdbId={item.tmdbId}
            standing={standing}
            basePath={`/library/${item.id}`}
          />
          <SeasonsList
            seasons={title.data.seasons}
            basePath={`/library/${item.id}`}
            progress={standing.progress}
          />
        </>
      )}
      {item.mediaType === 'tv' && <FollowRow detail={detail} />}

      {detail.plays.length > 0 && (
        <InsetGroupedList
          header="Play time"
          className="mt-3"
          footer={`${formatPlaytime(detail.plays.reduce((n, p) => n + p.minutes, 0))} in total${detail.steam ? ` · ${formatPlaytime(detail.steam.minutesTotal)} on Steam` : ''}`}
        >
          {detail.plays.slice(0, 10).map((play) => (
            <li key={play.id}>
              <div className="flex min-h-[2.75rem] items-center gap-2 px-4 py-2">
                <time dateTime={play.playedOn} className="flex-1 text-body text-label">
                  {formatDate(play.playedOn)}
                </time>
                <span className="text-body tabular-nums text-label-secondary">
                  {formatPlaytime(play.minutes)}
                </span>
                <span className="text-caption1 uppercase tracking-[0.05em] text-label-tertiary">
                  {play.source}
                </span>
              </div>
            </li>
          ))}
          {detail.plays.length > 10 && (
            <li>
              <p className="m-0 px-4 py-2 text-footnote text-label-secondary">
                and {detail.plays.length - 10} more days
              </p>
            </li>
          )}
        </InsetGroupedList>
      )}

      {detail.entries.length > 0 && (
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
      )}

      {title.data && <CastRow cast={title.data.cast} />}
      <TitleDetailsList
        mediaType={item.mediaType}
        status={title.data?.status ?? item.status}
        lastEpisodeToAir={title.data?.lastEpisodeToAir ?? item.lastEpisodeToAir}
        nextEpisodeToAir={title.data?.nextEpisodeToAir ?? item.nextEpisodeToAir}
        networks={title.data?.networks}
        productionCompanies={title.data?.productionCompanies}
        crew={title.data?.crew}
        releaseDate={item.releaseDate}
        platforms={title.data?.platforms}
        developers={title.data?.developers}
        publishers={title.data?.publishers}
      />

      <InsetGroupedList>
        {detail.steam && (
          <Row
            label="View on Steam"
            detail={
              detail.steam.lastPlayedAt
                ? `Last played ${formatRelativeDate(detail.steam.lastPlayedAt.slice(0, 10), todayLocalDateString())}`
                : undefined
            }
            href={detail.steam.storeUrl}
            external
            icon={<ArrowSquareOut className="size-5" aria-hidden="true" />}
          />
        )}
        <Row
          label={item.mediaType === 'game' ? 'View on IGDB' : 'View on TMDB'}
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
