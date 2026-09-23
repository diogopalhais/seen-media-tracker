import type {
  FilmProvider,
  GameProvider,
  MetadataProvider,
  ProviderSearchPage,
  ProviderSearchResult,
  ProviderSeasonDetails,
  ProviderTitleDetails,
  TrendingWindow,
} from './provider.js';
import { ProviderError } from './provider.js';

/** Stands in for IGDB when no credentials are configured: every call reports the source as unavailable. */
export class GamesNotConfigured implements GameProvider {
  private fail(): never {
    throw new ProviderError('unavailable', 'Games are not configured (IGDB credentials missing)');
  }
  searchGames(): Promise<ProviderSearchPage> {
    return Promise.reject(this.fail());
  }
  gameDetails(): Promise<ProviderTitleDetails> {
    return Promise.reject(this.fail());
  }
  trendingGames(): Promise<ProviderSearchResult[]> {
    return Promise.reject(this.fail());
  }
  topGames(): Promise<ProviderSearchResult[]> {
    return Promise.reject(this.fail());
  }
  gamesBySteamAppIds(): Promise<Map<number, number>> {
    return Promise.reject(this.fail());
  }
}

/** Routes movie and series lookups to one provider and game lookups to another. */
export class CompositeProvider implements MetadataProvider {
  constructor(
    private readonly film: FilmProvider,
    private readonly games: GameProvider,
  ) {}

  searchMovies(query: string, page: number): Promise<ProviderSearchPage> {
    return this.film.searchMovies(query, page);
  }
  searchTv(query: string, page: number): Promise<ProviderSearchPage> {
    return this.film.searchTv(query, page);
  }
  movieDetails(tmdbId: number): Promise<ProviderTitleDetails> {
    return this.film.movieDetails(tmdbId);
  }
  tvDetails(tmdbId: number): Promise<ProviderTitleDetails> {
    return this.film.tvDetails(tmdbId);
  }
  trendingAll(window: TrendingWindow): Promise<ProviderSearchResult[]> {
    return this.film.trendingAll(window);
  }
  popularMovies(): Promise<ProviderSearchResult[]> {
    return this.film.popularMovies();
  }
  popularTv(): Promise<ProviderSearchResult[]> {
    return this.film.popularTv();
  }
  tvSeason(tmdbId: number, seasonNumber: number): Promise<ProviderSeasonDetails> {
    return this.film.tvSeason(tmdbId, seasonNumber);
  }
  searchGames(query: string, page: number): Promise<ProviderSearchPage> {
    return this.games.searchGames(query, page);
  }
  gameDetails(igdbId: number): Promise<ProviderTitleDetails> {
    return this.games.gameDetails(igdbId);
  }
  trendingGames(): Promise<ProviderSearchResult[]> {
    return this.games.trendingGames();
  }
  topGames(): Promise<ProviderSearchResult[]> {
    return this.games.topGames();
  }
  gamesBySteamAppIds(appIds: number[]): Promise<Map<number, number>> {
    return this.games.gamesBySteamAppIds(appIds);
  }
}
