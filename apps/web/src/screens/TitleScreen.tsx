import { ArrowSquareOut, CheckCircle, Plus, SmileyMeh } from '@phosphor-icons/react';
import { MediaTypeSchema } from '@seen/shared';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../components/ui/Button.js';
import { InsetGroupedList, Row } from '../components/ui/InsetGroupedList.js';
import {
  Backdrop,
  EmptyState,
  MediaTypeBadge,
  Poster,
  RatingBadge,
} from '../components/ui/Media.js';
import { Screen } from '../components/ui/NavBar.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { ApiError } from '../lib/api.js';
import { formatRuntime, formatSeasons } from '../lib/format.js';
import { useBack } from '../lib/nav.js';
import { useTitleQuery } from '../lib/queries.js';
import { LogWatchSheet } from './LogWatchSheet.js';

export function TitleScreen() {
  const params = useParams<{ mediaType: string; tmdbId: string }>();
  const mediaType = MediaTypeSchema.safeParse(params.mediaType);
  const tmdbId = Number(params.tmdbId);
  const valid = mediaType.success && Number.isInteger(tmdbId) && tmdbId > 0;
  const back = useBack('/search');
  const navigate = useNavigate();
  const query = useTitleQuery(valid ? mediaType.data : undefined, valid ? tmdbId : undefined);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!valid || query.isError) {
    const notFound = !valid || (query.error instanceof ApiError && query.error.status === 404);
    return (
      <Screen title="Not Found" onBack={back} backLabel="Search" animate>
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
              <Button variant="tinted" onClick={() => navigate('/search', { replace: true })}>
                Back to Search
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
      <Screen title=" " onBack={back} backLabel="Search" animate>
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

  const meta = [t.releaseYear, formatRuntime(t.runtimeMinutes), formatSeasons(t.numberOfSeasons)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen title={t.title} onBack={back} backLabel="Search" animate>
      <Backdrop src={t.backdropUrl}>
        <Poster
          src={t.posterUrl}
          alt={t.title}
          className="w-28 shrink-0 shadow-[var(--shadow-poster)]"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-end gap-0.5 pb-1">
          <h2 className="m-0 text-title2 leading-tight">{t.title}</h2>
          {t.originalTitle !== t.title && (
            <p className="m-0 text-footnote text-label-secondary">{t.originalTitle}</p>
          )}
          <p className="m-0 flex flex-wrap items-center gap-1 text-footnote text-label-secondary">
            <MediaTypeBadge mediaType={t.mediaType} />
            {meta && <span>{meta}</span>}
          </p>
          {t.inLibrary && (
            <div className="mt-0.5 flex items-center gap-1">
              <RatingBadge rating={t.rating} size="large" />
              <span className="flex items-center gap-0.5 text-footnote font-medium text-success">
                <CheckCircle weight="fill" className="size-4" aria-hidden="true" />
                Seen
              </span>
            </div>
          )}
        </div>
      </Backdrop>

      {t.genres.length > 0 && (
        <ul className="safe-x m-0 mt-4 flex list-none flex-wrap gap-1.5 py-0">
          {t.genres.map((g) => (
            <li
              key={g.id}
              className="rounded-full bg-fill px-1 py-[2px] text-caption1 text-label-secondary"
            >
              {g.name}
            </li>
          ))}
        </ul>
      )}

      {t.overview && (
        <p className="safe-x m-0 mt-4 text-callout leading-relaxed text-label">{t.overview}</p>
      )}

      <div className="safe-x mt-5">
        <Button
          variant="filled"
          size="large"
          block
          icon={<Plus weight="bold" className="size-5" aria-hidden="true" />}
          onClick={() => setSheetOpen(true)}
        >
          Log Watch
        </Button>
      </div>

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

      <LogWatchSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={{ kind: 'create' }}
        target={{
          mediaType: t.mediaType,
          tmdbId: t.tmdbId,
          title: t.title,
          releaseYear: t.releaseYear,
          seasons: t.seasons,
          numberOfSeasons: t.numberOfSeasons,
        }}
        onSaved={(res) => navigate(`/library/${res.item.id}`)}
      />
    </Screen>
  );
}
