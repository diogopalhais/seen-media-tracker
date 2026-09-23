import { FilmSlate, GameController, type Icon, Television } from '@phosphor-icons/react';
import type { MediaType, MediaTypeFilter } from '@seen/shared';

/**
 * Everything the UI needs to present one kind of media. Adding a media type means adding one
 * entry here: the `Record<MediaType, …>` type makes the compiler point at every place that must
 * follow, and every badge, chip, title and empty state reads from this table.
 */
export interface MediaKind {
  type: MediaType;
  /** Singular noun: "Movie". */
  label: string;
  /** Plural noun for headers and filters: "Movies". */
  plural: string;
  /** Short filter label when space is tight: "TV". */
  short: string;
  icon: Icon;
  /** Past-tense verb: "Watched", "Played". */
  done: string;
  /** CSS custom property holding the kind's accent colour. */
  accentVar: `--kind-${MediaType}`;
  /** Tailwind classes for the accent: as text, as background, and on a selected filter chip. */
  textClass: string;
  bgClass: string;
  selectedChipClass: string;
  emptyTitle: string;
}

export const MEDIA_KINDS: Record<MediaType, MediaKind> = {
  movie: {
    type: 'movie',
    label: 'Movie',
    plural: 'Movies',
    short: 'Movies',
    icon: FilmSlate,
    done: 'Watched',
    accentVar: '--kind-movie',
    textClass: 'text-kind-movie',
    bgClass: 'bg-kind-movie',
    selectedChipClass: 'data-[state=checked]:bg-kind-movie data-[state=checked]:text-white',
    emptyTitle: 'No movies yet',
  },
  tv: {
    type: 'tv',
    label: 'Series',
    plural: 'Series',
    short: 'TV',
    icon: Television,
    done: 'Watched',
    accentVar: '--kind-tv',
    textClass: 'text-kind-tv',
    bgClass: 'bg-kind-tv',
    selectedChipClass: 'data-[state=checked]:bg-kind-tv data-[state=checked]:text-white',
    emptyTitle: 'No TV series yet',
  },
  game: {
    type: 'game',
    label: 'Game',
    plural: 'Games',
    short: 'Games',
    icon: GameController,
    done: 'Played',
    accentVar: '--kind-game',
    textClass: 'text-kind-game',
    bgClass: 'bg-kind-game',
    selectedChipClass: 'data-[state=checked]:bg-kind-game data-[state=checked]:text-white',
    emptyTitle: 'No games yet',
  },
};

/** Display order for filters and sections. */
export const MEDIA_KIND_ORDER: readonly MediaType[] = ['movie', 'tv', 'game'];

export function mediaKind(type: MediaType): MediaKind {
  return MEDIA_KINDS[type];
}

/** Kinds this deployment offers, in display order. */
export function availableKinds(features: { games: boolean }): MediaKind[] {
  return MEDIA_KIND_ORDER.filter((t) => t !== 'game' || features.games).map((t) => MEDIA_KINDS[t]);
}

/** Header for a library grid: "Everything seen", "Movies watched", "Games played". */
export function libraryTitle(filter: MediaTypeFilter): string {
  if (filter === 'all') return 'Everything seen';
  const kind = MEDIA_KINDS[filter];
  return `${kind.plural} ${kind.done.toLowerCase()}`;
}
