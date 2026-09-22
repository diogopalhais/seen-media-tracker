import type { Season, SeriesProgress } from '@seen/shared';
import { useNavigate } from 'react-router';
import { InsetGroupedList, Row } from './ui/InsetGroupedList.js';

/** Where the owner stands with one season: "Watched", "Up to date", "3 left", or nothing when untouched. */
export function seasonStanding(
  s: SeriesProgress['perSeason'][number] | undefined,
): string | undefined {
  if (!s || s.aired === 0 || s.watchedAired === 0) return undefined;
  if (s.watchedAired < s.aired) return `${s.aired - s.watchedAired} left`;
  return s.aired < s.total ? 'Up to date' : 'Watched';
}

/** Season rows for a TV series; each navigates to the season screen under the current tab. */
export function SeasonsList({
  seasons,
  basePath,
  progress,
}: {
  seasons: Season[];
  basePath: string;
  progress?: SeriesProgress | null;
}) {
  const navigate = useNavigate();
  if (seasons.length === 0) return null;
  return (
    <InsetGroupedList header="Seasons" className="mt-5">
      {seasons.map((s) => {
        const ps = progress?.perSeason.find((p) => p.seasonNumber === s.seasonNumber);
        const episodes =
          ps && ps.aired < ps.total
            ? `${ps.aired} of ${ps.total} aired`
            : `${s.episodeCount} ${s.episodeCount === 1 ? 'episode' : 'episodes'}`;
        return (
          <Row
            key={s.seasonNumber}
            label={s.isSpecials ? 'Specials' : s.name || `Season ${s.seasonNumber}`}
            detail={[s.airDate ? s.airDate.slice(0, 4) : null, episodes]
              .filter(Boolean)
              .join(' · ')}
            value={seasonStanding(ps)}
            onPress={() => navigate(`${basePath}/season/${s.seasonNumber}`)}
          />
        );
      })}
    </InsetGroupedList>
  );
}
