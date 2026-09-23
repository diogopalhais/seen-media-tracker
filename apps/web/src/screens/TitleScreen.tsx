import { ArrowSquareOut, SmileyMeh } from '@phosphor-icons/react';
import { MediaTypeSchema } from '@seen/shared';
import { useLocation, useNavigate, useParams } from 'react-router';
import { CastRow } from '../components/CastRow.js';
import { FollowRow } from '../components/FollowRow.js';
import { ContinueWatchingCard } from '../components/Progress.js';
import { SeasonsList } from '../components/SeasonsList.js';
import { TitleDetailsList } from '../components/TitleDetailsList.js';
import { TitleHero } from '../components/TitleHero.js';
import { Button } from '../components/ui/Button.js';
import { InsetGroupedList, Row } from '../components/ui/InsetGroupedList.js';
import { EmptyState } from '../components/ui/Media.js';
import { Screen } from '../components/ui/NavBar.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { WatchActions } from '../components/WatchActions.js';
import { ApiError } from '../lib/api.js';
import { useBack } from '../lib/nav.js';
import { useLibraryItemQuery, useTitleQuery } from '../lib/queries.js';
import { useSeriesStanding } from '../lib/seriesProgress.js';

export function TitleScreen() {
  const params = useParams<{ mediaType: string; tmdbId: string }>();
  const mediaType = MediaTypeSchema.safeParse(params.mediaType);
  const tmdbId = Number(params.tmdbId);
  const valid = mediaType.success && Number.isInteger(tmdbId) && tmdbId > 0;
  const base = useLocation().pathname.startsWith('/discover') ? '/discover' : '/search';
  const backLabel = base === '/discover' ? 'Discover' : 'Search';
  const back = useBack(base);
  const navigate = useNavigate();
  const query = useTitleQuery(valid ? mediaType.data : undefined, valid ? tmdbId : undefined);
  const libraryItem = useLibraryItemQuery(query.data?.libraryItemId ?? undefined);
  const standing = useSeriesStanding({
    tmdbId: query.data?.tmdbId,
    seasons: query.data?.mediaType === 'tv' ? query.data.seasons : null,
    detail: libraryItem.data,
    status: query.data?.status,
    lastEpisodeToAir: query.data?.lastEpisodeToAir,
    nextEpisodeToAir: query.data?.nextEpisodeToAir,
  });

  if (!valid || query.isError) {
    const notFound = !valid || (query.error instanceof ApiError && query.error.status === 404);
    return (
      <Screen title="Not Found" onBack={back} backLabel={backLabel} animate>
        <EmptyState
          icon={<SmileyMeh />}
          title={notFound ? "This title doesn't exist" : "Couldn't load this title"}
          message={
            notFound
              ? 'Check the link or search again.'
              : ((query.error as Error | null)?.message ?? 'Please try again.')
          }
          action={
            notFound ? (
              <Button variant="tinted" onClick={() => navigate(base, { replace: true })}>
                Back
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

  const t = query.data;
  if (!t) {
    return (
      <Screen title=" " onBack={back} backLabel={backLabel} animate>
        <div className="safe-x flex gap-2 py-2">
          <Skeleton className="aspect-[2/3] w-28 rounded-card" />
          <div className="flex flex-1 flex-col gap-1 pt-1">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title={t.title} onBack={back} backLabel={backLabel} transparent animate>
      <TitleHero
        title={t.title}
        originalTitle={t.originalTitle}
        mediaType={t.mediaType}
        releaseYear={t.releaseYear}
        runtimeMinutes={t.runtimeMinutes}
        numberOfSeasons={t.numberOfSeasons}
        genres={t.genres}
        posterUrl={t.posterUrl}
        backdropUrl={t.backdropUrl}
        overview={t.overview}
        tmdbRating={t.tmdbRating}
        ownerRating={libraryItem.data?.rating ?? t.rating}
        platforms={t.platforms}
        actions={
          <WatchActions
            target={{
              mediaType: t.mediaType,
              tmdbId: t.tmdbId,
              title: t.title,
              releaseYear: t.releaseYear,
              seasons: t.seasons,
              numberOfSeasons: t.numberOfSeasons,
            }}
            detail={libraryItem.data}
            loading={Boolean(t.libraryItemId) && libraryItem.isPending}
            series={standing ? { standing, basePath: `${base}/tv/${t.tmdbId}` } : null}
          />
        }
      />

      {t.mediaType === 'tv' && t.seasons && standing && (
        <>
          {libraryItem.data && (
            <ContinueWatchingCard
              tmdbId={t.tmdbId}
              standing={standing}
              basePath={`${base}/tv/${t.tmdbId}`}
            />
          )}
          <SeasonsList
            seasons={t.seasons}
            basePath={`${base}/tv/${t.tmdbId}`}
            progress={standing.progress}
          />
        </>
      )}
      {t.mediaType === 'tv' && libraryItem.data && <FollowRow detail={libraryItem.data} />}

      <CastRow cast={t.cast} />
      <TitleDetailsList
        mediaType={t.mediaType}
        status={t.status}
        lastEpisodeToAir={t.lastEpisodeToAir}
        nextEpisodeToAir={t.nextEpisodeToAir}
        networks={t.networks}
        productionCompanies={t.productionCompanies}
        crew={t.crew}
        releaseDate={t.releaseDate}
        platforms={t.platforms}
        developers={t.developers}
        publishers={t.publishers}
      />

      <InsetGroupedList className="mt-3">
        {t.inLibrary && t.libraryItemId && (
          <Row
            label="View in Library"
            detail="Your watch history and notes"
            onPress={() => navigate(`/library/${t.libraryItemId}`)}
          />
        )}
        <Row
          label="View on TMDB"
          href={t.tmdbUrl}
          external
          icon={<ArrowSquareOut className="size-5" aria-hidden="true" />}
        />
      </InsetGroupedList>
    </Screen>
  );
}
