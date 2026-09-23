import type { Genre, MediaType, Season } from '@seen/shared';

export interface ProviderSearchResult {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  releaseDate: string | null;
  posterPath: string | null;
  overview: string;
  popularity: number;
  voteAverage: number | null;
  voteCount: number;
}

export interface ProviderSearchPage {
  results: ProviderSearchResult[];
  page: number;
  totalPages: number;
}

export interface ProviderPerson {
  tmdbId: number;
  name: string;
  /** Character for cast, job for crew. */
  role: string;
  profilePath: string | null;
}

export interface ProviderCompany {
  tmdbId: number;
  name: string;
  logoPath: string | null;
}

export interface ProviderEpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string | null;
}

export interface ProviderTitleDetails {
  mediaType: MediaType;
  /** Provider id: TMDB for movies and series, IGDB for games. */
  tmdbId: number;
  /** Provider page when it cannot be derived from the id (IGDB slugs); null for TMDB titles. */
  externalUrl: string | null;
  title: string;
  originalTitle: string;
  releaseDate: string | null;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  genres: Genre[];
  runtimeMinutes: number | null;
  numberOfSeasons: number | null;
  seasons: Season[] | null;
  voteAverage: number | null;
  voteCount: number;
  /** Provider status label verbatim ("Returning Series", "Ended", "Released", ...). */
  status: string | null;
  lastEpisodeToAir: ProviderEpisodeRef | null;
  nextEpisodeToAir: ProviderEpisodeRef | null;
  cast: ProviderPerson[];
  crew: ProviderPerson[];
  networks: ProviderCompany[];
  productionCompanies: ProviderCompany[];
  /** Games only; empty for movies and series. */
  platforms: ProviderCompany[];
  developers: ProviderCompany[];
  publishers: ProviderCompany[];
}

export interface ProviderEpisode {
  episodeNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  runtimeMinutes: number | null;
  stillPath: string | null;
  voteAverage: number | null;
  voteCount: number;
}

export interface ProviderSeasonDetails {
  tmdbId: number;
  seasonNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  posterPath: string | null;
  episodes: ProviderEpisode[];
}

export type TrendingWindow = 'day' | 'week';

export type ProviderErrorKind = 'not_found' | 'unavailable';

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ProviderError';
  }
}

/** Movies and TV series (TMDB). */
export interface FilmProvider {
  searchMovies(query: string, page: number): Promise<ProviderSearchPage>;
  searchTv(query: string, page: number): Promise<ProviderSearchPage>;
  movieDetails(tmdbId: number): Promise<ProviderTitleDetails>;
  tvDetails(tmdbId: number): Promise<ProviderTitleDetails>;
  /** Movies and TV series trending over the window (people are excluded). */
  trendingAll(window: TrendingWindow): Promise<ProviderSearchResult[]>;
  popularMovies(): Promise<ProviderSearchResult[]>;
  popularTv(): Promise<ProviderSearchResult[]>;
  tvSeason(tmdbId: number, seasonNumber: number): Promise<ProviderSeasonDetails>;
}

/** Video games (IGDB). Every method throws `ProviderError('unavailable')` when games are not configured. */
export interface GameProvider {
  searchGames(query: string, page: number): Promise<ProviderSearchPage>;
  gameDetails(igdbId: number): Promise<ProviderTitleDetails>;
  /** Games people are playing right now. */
  trendingGames(): Promise<ProviderSearchResult[]>;
  /** Best rated games released in the last year. */
  topGames(): Promise<ProviderSearchResult[]>;
  /** IGDB ids for Steam app ids; apps IGDB does not know are absent from the map. */
  gamesBySteamAppIds(appIds: number[]): Promise<Map<number, number>>;
}

/**
 * Abstracts the metadata sources so routes can be tested with a stub. Movies and series come from
 * one provider, games from another; `CompositeProvider` joins them.
 */
export interface MetadataProvider extends FilmProvider, GameProvider {}

export function releaseYear(releaseDate: string | null): number | null {
  if (!releaseDate) return null;
  const year = Number(releaseDate.slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : null;
}

export function detailsFor(provider: MetadataProvider, mediaType: MediaType, tmdbId: number) {
  switch (mediaType) {
    case 'movie':
      return provider.movieDetails(tmdbId);
    case 'tv':
      return provider.tvDetails(tmdbId);
    case 'game':
      return provider.gameDetails(tmdbId);
  }
}
