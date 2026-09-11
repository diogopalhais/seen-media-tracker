import { z } from 'zod';
import {
  type MetadataProvider,
  ProviderError,
  type ProviderSearchPage,
  type ProviderSearchResult,
  type ProviderTitleDetails,
} from './provider.js';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';

const searchMovieSchema = z.object({
  page: z.number(),
  total_pages: z.number(),
  results: z.array(
    z.object({
      id: z.number(),
      title: z.string().default(''),
      original_title: z.string().default(''),
      release_date: z.string().nullish(),
      poster_path: z.string().nullish(),
      overview: z.string().default(''),
      popularity: z.number().default(0),
    }),
  ),
});

const searchTvSchema = z.object({
  page: z.number(),
  total_pages: z.number(),
  results: z.array(
    z.object({
      id: z.number(),
      name: z.string().default(''),
      original_name: z.string().default(''),
      first_air_date: z.string().nullish(),
      poster_path: z.string().nullish(),
      overview: z.string().default(''),
      popularity: z.number().default(0),
    }),
  ),
});

const genreSchema = z.object({ id: z.number(), name: z.string() });

const movieDetailsSchema = z.object({
  id: z.number(),
  title: z.string().default(''),
  original_title: z.string().default(''),
  release_date: z.string().nullish(),
  overview: z.string().default(''),
  poster_path: z.string().nullish(),
  backdrop_path: z.string().nullish(),
  genres: z.array(genreSchema).default([]),
  runtime: z.number().nullish(),
});

const tvDetailsSchema = z.object({
  id: z.number(),
  name: z.string().default(''),
  original_name: z.string().default(''),
  first_air_date: z.string().nullish(),
  overview: z.string().default(''),
  poster_path: z.string().nullish(),
  backdrop_path: z.string().nullish(),
  genres: z.array(genreSchema).default([]),
  number_of_seasons: z.number().nullish(),
  seasons: z
    .array(
      z.object({
        season_number: z.number(),
        name: z.string().default(''),
        episode_count: z.number().default(0),
      }),
    )
    .default([]),
});

export interface TmdbOptions {
  token: string;
  language: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class TmdbProvider implements MetadataProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly opts: TmdbOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 8000;
  }

  private async get(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(`${TMDB_API_BASE}${path}`);
    url.searchParams.set('language', this.opts.language);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        headers: { Authorization: `Bearer ${this.opts.token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new ProviderError('unavailable', 'Metadata provider unreachable', { cause: err });
    }
    if (res.status === 404)
      throw new ProviderError('not_found', 'Title not found at metadata provider');
    if (!res.ok)
      throw new ProviderError('unavailable', `Metadata provider responded ${res.status}`);
    try {
      return await res.json();
    } catch (err) {
      throw new ProviderError('unavailable', 'Metadata provider returned invalid JSON', {
        cause: err,
      });
    }
  }

  private parse<T>(schema: z.ZodType<T>, data: unknown): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new ProviderError('unavailable', 'Metadata provider returned an unexpected shape', {
        cause: parsed.error,
      });
    }
    return parsed.data;
  }

  async searchMovies(query: string, page: number): Promise<ProviderSearchPage> {
    const data = this.parse(
      searchMovieSchema,
      await this.get('/search/movie', { query, page: String(page), include_adult: 'false' }),
    );
    return {
      page: data.page,
      totalPages: data.total_pages,
      results: data.results.map(
        (r): ProviderSearchResult => ({
          tmdbId: r.id,
          mediaType: 'movie',
          title: r.title,
          originalTitle: r.original_title,
          releaseDate: r.release_date || null,
          posterPath: r.poster_path ?? null,
          overview: r.overview,
          popularity: r.popularity,
        }),
      ),
    };
  }

  async searchTv(query: string, page: number): Promise<ProviderSearchPage> {
    const data = this.parse(
      searchTvSchema,
      await this.get('/search/tv', { query, page: String(page), include_adult: 'false' }),
    );
    return {
      page: data.page,
      totalPages: data.total_pages,
      results: data.results.map(
        (r): ProviderSearchResult => ({
          tmdbId: r.id,
          mediaType: 'tv',
          title: r.name,
          originalTitle: r.original_name,
          releaseDate: r.first_air_date || null,
          posterPath: r.poster_path ?? null,
          overview: r.overview,
          popularity: r.popularity,
        }),
      ),
    };
  }

  async movieDetails(tmdbId: number): Promise<ProviderTitleDetails> {
    const d = this.parse(movieDetailsSchema, await this.get(`/movie/${tmdbId}`, {}));
    return {
      mediaType: 'movie',
      tmdbId: d.id,
      title: d.title,
      originalTitle: d.original_title,
      releaseDate: d.release_date || null,
      overview: d.overview,
      posterPath: d.poster_path ?? null,
      backdropPath: d.backdrop_path ?? null,
      genres: d.genres,
      runtimeMinutes: d.runtime ?? null,
      numberOfSeasons: null,
      seasons: null,
    };
  }

  async tvDetails(tmdbId: number): Promise<ProviderTitleDetails> {
    const d = this.parse(tvDetailsSchema, await this.get(`/tv/${tmdbId}`, {}));
    return {
      mediaType: 'tv',
      tmdbId: d.id,
      title: d.name,
      originalTitle: d.original_name,
      releaseDate: d.first_air_date || null,
      overview: d.overview,
      posterPath: d.poster_path ?? null,
      backdropPath: d.backdrop_path ?? null,
      genres: d.genres,
      runtimeMinutes: null,
      numberOfSeasons: d.number_of_seasons ?? null,
      seasons: d.seasons
        .slice()
        .sort((a, b) => a.season_number - b.season_number)
        .map((s) => ({
          seasonNumber: s.season_number,
          name: s.name,
          episodeCount: s.episode_count,
          isSpecials: s.season_number === 0,
        })),
    };
  }
}
