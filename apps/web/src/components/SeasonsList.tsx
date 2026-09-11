import type { Season } from '@seen/shared';
import { useNavigate } from 'react-router';
import { InsetGroupedList, Row } from './ui/InsetGroupedList.js';

/** Season rows for a TV series; each navigates to the season screen under the current tab. */
export function SeasonsList({ seasons, basePath }: { seasons: Season[]; basePath: string }) {
  const navigate = useNavigate();
  if (seasons.length === 0) return null;
  return (
    <InsetGroupedList header="Seasons" className="mt-5">
      {seasons.map((s) => (
        <Row
          key={s.seasonNumber}
          label={s.isSpecials ? 'Specials' : s.name || `Season ${s.seasonNumber}`}
          detail={[
            s.airDate ? s.airDate.slice(0, 4) : null,
            `${s.episodeCount} ${s.episodeCount === 1 ? 'episode' : 'episodes'}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          onPress={() => navigate(`${basePath}/season/${s.seasonNumber}`)}
        />
      ))}
    </InsetGroupedList>
  );
}
