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
  tmdbId: number;
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

/** Abstracts the metadata source so routes can be tested with a stub and the provider swapped later. */
export interface MetadataProvider {
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

export function releaseYear(releaseDate: string | null): number | null {
  if (!releaseDate) return null;
  const year = Number(releaseDate.slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : null;
}

export function detailsFor(provider: MetadataProvider, mediaType: MediaType, tmdbId: number) {
  return mediaType === 'movie' ? provider.movieDetails(tmdbId) : provider.tvDetails(tmdbId);
}
