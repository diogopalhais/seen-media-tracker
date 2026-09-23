import type {
  MetadataProvider,
  ProviderSearchPage,
  ProviderSearchResult,
  ProviderSeasonDetails,
  ProviderTitleDetails,
  TrendingWindow,
} from './provider.js';

interface Entry<T> {
  value: Promise<T>;
  expiresAt: number;
}

/** Tiny LRU with per-entry TTL. Stores promises so concurrent identical lookups share one upstream call. */
export class LruCache<T> {
  private readonly map = new Map<string, Entry<T>>();

  constructor(
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): Promise<T> | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: Promise<T>, ttlMs: number): void {
    this.map.delete(key);
    this.map.set(key, { value, expiresAt: this.now() + ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }
}

export const SEARCH_TTL_MS = 5 * 60 * 1000;
export const DETAILS_TTL_MS = 60 * 60 * 1000;

export class CachedMetadataProvider implements MetadataProvider {
  private readonly searches = new LruCache<ProviderSearchPage>(500);
  private readonly details = new LruCache<ProviderTitleDetails>(1000);
  private readonly lists = new LruCache<ProviderSearchResult[]>(10);
  private readonly seasons = new LruCache<ProviderSeasonDetails>(500);

  constructor(private readonly inner: MetadataProvider) {}

  private cached<T>(
    cache: LruCache<T>,
    key: string,
    ttl: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const hit = cache.get(key);
    if (hit) return hit;
    const value = load();
    cache.set(key, value, ttl);
    // Failures must not be cached, otherwise a transient outage would stick for the TTL.
    value.catch(() => cache.delete(key));
    return value;
  }

  searchMovies(query: string, page: number): Promise<ProviderSearchPage> {
    return this.cached(this.searches, `movie:${page}:${query.toLowerCase()}`, SEARCH_TTL_MS, () =>
      this.inner.searchMovies(query, page),
    );
  }

  searchTv(query: string, page: number): Promise<ProviderSearchPage> {
    return this.cached(this.searches, `tv:${page}:${query.toLowerCase()}`, SEARCH_TTL_MS, () =>
      this.inner.searchTv(query, page),
    );
  }

  movieDetails(tmdbId: number): Promise<ProviderTitleDetails> {
    return this.cached(this.details, `movie:${tmdbId}`, DETAILS_TTL_MS, () =>
      this.inner.movieDetails(tmdbId),
    );
  }

  tvDetails(tmdbId: number): Promise<ProviderTitleDetails> {
    return this.cached(this.details, `tv:${tmdbId}`, DETAILS_TTL_MS, () =>
      this.inner.tvDetails(tmdbId),
    );
  }

  trendingAll(window: TrendingWindow): Promise<ProviderSearchResult[]> {
    return this.cached(this.lists, `trending:${window}`, DETAILS_TTL_MS, () =>
      this.inner.trendingAll(window),
    );
  }

  popularMovies(): Promise<ProviderSearchResult[]> {
    return this.cached(this.lists, 'popular:movie', DETAILS_TTL_MS, () =>
      this.inner.popularMovies(),
    );
  }

  popularTv(): Promise<ProviderSearchResult[]> {
    return this.cached(this.lists, 'popular:tv', DETAILS_TTL_MS, () => this.inner.popularTv());
  }

  tvSeason(tmdbId: number, seasonNumber: number): Promise<ProviderSeasonDetails> {
    return this.cached(this.seasons, `season:${tmdbId}:${seasonNumber}`, DETAILS_TTL_MS, () =>
      this.inner.tvSeason(tmdbId, seasonNumber),
    );
  }

  searchGames(query: string, page: number): Promise<ProviderSearchPage> {
    return this.cached(this.searches, `game:${page}:${query.toLowerCase()}`, SEARCH_TTL_MS, () =>
      this.inner.searchGames(query, page),
    );
  }

  gameDetails(igdbId: number): Promise<ProviderTitleDetails> {
    return this.cached(this.details, `game:${igdbId}`, DETAILS_TTL_MS, () =>
      this.inner.gameDetails(igdbId),
    );
  }

  trendingGames(): Promise<ProviderSearchResult[]> {
    return this.cached(this.lists, 'trending:game', DETAILS_TTL_MS, () =>
      this.inner.trendingGames(),
    );
  }

  topGames(): Promise<ProviderSearchResult[]> {
    return this.cached(this.lists, 'top:game', DETAILS_TTL_MS, () => this.inner.topGames());
  }

  /** Id mappings are looked up once per app by the Steam sync; nothing to cache. */
  gamesBySteamAppIds(appIds: number[]): Promise<Map<number, number>> {
    return this.inner.gamesBySteamAppIds(appIds);
  }
}
