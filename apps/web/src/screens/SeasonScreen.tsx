import { CaretDown, Plus, SmileyMeh } from '@phosphor-icons/react';
import type { Episode, SeasonDetails, TitleDetails } from '@seen/shared';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../components/ui/Button.js';
import { EmptyState, Poster, TmdbRating } from '../components/ui/Media.js';
import { Screen } from '../components/ui/NavBar.js';
import { ListSkeleton, Skeleton } from '../components/ui/Skeleton.js';
import { ApiError } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { formatDate, formatRuntime } from '../lib/format.js';
import { useBack } from '../lib/nav.js';
import { useLibraryItemQuery, useSeasonQuery, useTitleQuery } from '../lib/queries.js';
import { LogWatchSheet } from './LogWatchSheet.js';

/**
 * Season detail: episodes of one season. Mounted under both tab trees:
 *   /search/tv/:tmdbId/season/:seasonNumber        (tmdbId in the URL)
 *   /library/:itemId/season/:seasonNumber          (tmdbId resolved from the library item)
 */
export function SeasonScreen() {
  const params = useParams<{ tmdbId?: string; itemId?: string; seasonNumber: string }>();
  const seasonNumber = Number(params.seasonNumber);
  const item = useLibraryItemQuery(params.itemId);
  const tmdbId = params.tmdbId ? Number(params.tmdbId) : item.data?.item.tmdbId;
  const validSeason = Number.isInteger(seasonNumber) && seasonNumber >= 0;
  const validId = tmdbId !== undefined && Number.isInteger(tmdbId) && tmdbId > 0;
  const parentPath = params.itemId ? `/library/${params.itemId}` : `/search/tv/${params.tmdbId}`;
  const back = useBack(parentPath);
  const navigate = useNavigate();
  const title = useTitleQuery(validId ? 'tv' : undefined, validId ? tmdbId : undefined);
  const season = useSeasonQuery(
    validId && validSeason ? tmdbId : undefined,
    validId && validSeason ? seasonNumber : undefined,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const seriesTitle = title.data?.title ?? item.data?.item.title ?? '';
  const failed = !validSeason || (params.itemId && item.isError) || season.isError;

  if (failed) {
    const err = season.error ?? item.error;
    const notFound = !validSeason || (err instanceof ApiError && err.status === 404);
    return (
      <Screen title="Season" onBack={back} backLabel={seriesTitle || 'Back'} animate>
        <EmptyState
          icon={<SmileyMeh />}
          title={notFound ? "This season doesn't exist" : "Couldn't load this season"}
          message={
            notFound
              ? 'Check the link or go back to the series.'
              : ((err as Error | null)?.message ?? 'Please try again.')
          }
          action={
            notFound ? (
              <Button variant="tinted" onClick={() => navigate(parentPath, { replace: true })}>
                Back to series
              </Button>
            ) : (
              <Button variant="tinted" onClick={() => void season.refetch()}>
                Retry
              </Button>
            )
          }
        />
      </Screen>
    );
  }

  const s = season.data;
  const screenTitle = s
    ? s.seasonNumber === 0
      ? 'Specials'
      : s.name || `Season ${s.seasonNumber}`
    : ' ';

  return (
    <Screen title={screenTitle} onBack={back} backLabel={seriesTitle || 'Back'} animate>
      {!s ? (
        <>
          <div className="safe-x flex gap-4 pt-4">
            <Skeleton className="aspect-[2/3] w-24 rounded-card" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <ListSkeleton rows={6} />
        </>
      ) : (
        <>
          <div className="safe-x flex gap-4 pt-4">
            <Poster
              src={s.posterUrl ?? title.data?.posterUrl ?? null}
              alt={`${seriesTitle} ${screenTitle}`}
              className="w-24 shrink-0 shadow-[var(--shadow-poster)]"
            />
            <div className="flex min-w-0 flex-1 flex-col justify-end gap-1 pb-1">
              <p className="m-0 text-footnote font-semibold uppercase tracking-[0.05em] text-label-secondary">
                {seriesTitle}
              </p>
              <h2 className="m-0 text-title2 leading-tight">{screenTitle}</h2>
              <p className="m-0 text-footnote text-label-secondary">
                {[
                  s.airDate ? s.airDate.slice(0, 4) : null,
                  `${s.episodeCount} ${s.episodeCount === 1 ? 'episode' : 'episodes'}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          {s.overview && (
            <p className="safe-x m-0 mt-4 text-callout leading-relaxed text-label">{s.overview}</p>
          )}

          <div className="safe-x mt-5">
            <Button
              variant="filled"
              size="large"
              block
              icon={<Plus weight="bold" className="size-5" aria-hidden="true" />}
              onClick={() => setSheetOpen(true)}
            >
              {s.seasonNumber === 0 ? 'Log Specials' : `Log Season ${s.seasonNumber}`}
            </Button>
          </div>

          <section className="safe-x mt-5" aria-label="Episodes">
            <h3 className="m-0 mb-2 px-1 text-footnote font-semibold uppercase tracking-[0.06em] text-label-secondary">
              Episodes
            </h3>
            <ul className="card m-0 list-none overflow-hidden py-0 [&>li]:relative [&>li+li]:before:absolute [&>li+li]:before:left-4 [&>li+li]:before:right-0 [&>li+li]:before:top-0 [&>li+li]:before:h-px [&>li+li]:before:bg-separator [&>li+li]:before:content-['']">
              {s.episodes.map((e) => (
                <EpisodeRow key={e.episodeNumber} episode={e} />
              ))}
            </ul>
          </section>

          {title.data && (
            <LogWatchSheet
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              mode={{ kind: 'create', initialSeason: s.seasonNumber }}
              target={targetFrom(title.data, s)}
              onSaved={(res) => navigate(`/library/${res.item.id}`)}
            />
          )}
        </>
      )}
    </Screen>
  );
}

function targetFrom(t: TitleDetails, _s: SeasonDetails) {
  return {
    mediaType: 'tv' as const,
    tmdbId: t.tmdbId,
    title: t.title,
    releaseYear: t.releaseYear,
    seasons: t.seasons,
    numberOfSeasons: t.numberOfSeasons,
  };
}

/** Expandable episode row: still, number, name, air date, runtime, rating; tap reveals the overview. */
function EpisodeRow({ episode }: { episode: Episode }) {
  const [open, setOpen] = useState(false);
  const meta = [
    episode.airDate ? formatDate(episode.airDate) : null,
    formatRuntime(episode.runtimeMinutes),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="pressable flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-fill">
          {episode.stillUrl ? (
            <img
              src={episode.stillUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-caption1 font-semibold text-label-tertiary">
              E{episode.episodeNumber}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-medium text-label">
            <span className="text-label-secondary">{episode.episodeNumber}. </span>
            {episode.name}
          </span>
          {meta && <span className="text-footnote text-label-secondary">{meta}</span>}
          <TmdbRating rating={episode.tmdbRating} size="small" />
          {open && episode.overview && (
            <p className="m-0 mt-2 text-subheadline leading-relaxed text-label">
              {episode.overview}
            </p>
          )}
        </div>
        <CaretDown
          weight="bold"
          aria-hidden="true"
          className={cn(
            'mt-1 size-4 shrink-0 text-label-tertiary transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
    </li>
  );
}
