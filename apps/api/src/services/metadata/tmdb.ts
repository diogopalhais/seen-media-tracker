import { z } from 'zod';
import {
  type MetadataProvider,
  type ProviderCompany,
  type ProviderEpisodeRef,
  ProviderError,
  type ProviderPerson,
  type ProviderSearchPage,
  type ProviderSearchResult,
  type ProviderSeasonDetails,
  type ProviderTitleDetails,
  type TrendingWindow,
} from './provider.js';

const votes = { vote_average: z.number().nullish(), vote_count: z.number().nullish() };

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
      ...votes,
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
      ...votes,
    }),
  ),
});

const trendingSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      media_type: z.string(),
      title: z.string().nullish(),
      name: z.string().nullish(),
      original_title: z.string().nullish(),
      original_name: z.string().nullish(),
      release_date: z.string().nullish(),
      first_air_date: z.string().nullish(),
      poster_path: z.string().nullish(),
      overview: z.string().default(''),
      popularity: z.number().default(0),
      ...votes,
    }),
  ),
});

const seasonDetailsSchema = z.object({
  season_number: z.number(),
  name: z.string().default(''),
  overview: z.string().default(''),
  air_date: z.string().nullish(),
  poster_path: z.string().nullish(),
  episodes: z
    .array(
      z.object({
        episode_number: z.number(),
        name: z.string().default(''),
        overview: z.string().default(''),
        air_date: z.string().nullish(),
        runtime: z.number().nullish(),
        still_path: z.string().nullish(),
        ...votes,
      }),
    )
    .default([]),
});

const genreSchema = z.object({ id: z.number(), name: z.string() });

const companySchema = z.object({
  id: z.number(),
  name: z.string().default(''),
  logo_path: z.string().nullish(),
});

const episodeRefSchema = z
  .object({
    season_number: z.number(),
    episode_number: z.number(),
    name: z.string().default(''),
    air_date: z.string().nullish(),
  })
  .nullish();

const movieCreditsSchema = z
  .object({
    cast: z
      .array(
        z.object({
          id: z.number(),
          name: z.string().default(''),
          character: z.string().nullish(),
          profile_path: z.string().nullish(),
          order: z.number().default(9999),
        }),
      )
      .default([]),
    crew: z
      .array(
        z.object({
          id: z.number(),
          name: z.string().default(''),
          job: z.string().nullish(),
          profile_path: z.string().nullish(),
        }),
      )
      .default([]),
  })
  .nullish();

const aggregateCreditsSchema = z
  .object({
    cast: z
      .array(
        z.object({
          id: z.number(),
          name: z.string().default(''),
          profile_path: z.string().nullish(),
          order: z.number().default(9999),
          roles: z.array(z.object({ character: z.string().nullish() })).default([]),
        }),
      )
      .default([]),
  })
  .nullish();

export const CAST_LIMIT = 15;
/** Movie crew jobs worth surfacing, in display order. */
const MOVIE_CREW_JOBS = ['Director', 'Screenplay', 'Writer', 'Story'];
const COMPANY_LIMIT = 5;

function toCompany(c: z.infer<typeof companySchema>): ProviderCompany {
  return { tmdbId: c.id, name: c.name, logoPath: c.logo_path ?? null };
}

function toEpisodeRef(e: z.infer<typeof episodeRefSchema>): ProviderEpisodeRef | null {
  if (!e) return null;
  return {
    seasonNumber: e.season_number,
    episodeNumber: e.episode_number,
    name: e.name,
    airDate: e.air_date || null,
  };
}

/** Merges a person's jobs ("Director, Screenplay") and keeps only the jobs listed above, in that order. */
function movieCrew(
  crew: NonNullable<z.infer<typeof movieCreditsSchema>>['crew'],
): ProviderPerson[] {
  const byPerson = new Map<number, ProviderPerson & { jobs: string[] }>();
  for (const c of crew) {
    if (!c.job || !MOVIE_CREW_JOBS.includes(c.job)) continue;
    const existing = byPerson.get(c.id);
    if (existing) {
      if (!existing.jobs.includes(c.job)) existing.jobs.push(c.job);
    } else {
      byPerson.set(c.id, {
        tmdbId: c.id,
        name: c.name,
        role: c.job,
        profilePath: c.profile_path ?? null,
        jobs: [c.job],
      });
    }
  }
  return [...byPerson.values()]
    .sort(
      (a, b) => MOVIE_CREW_JOBS.indexOf(a.jobs[0] ?? '') - MOVIE_CREW_JOBS.indexOf(b.jobs[0] ?? ''),
    )
    .map(({ jobs, ...p }) => ({
      ...p,
      role: MOVIE_CREW_JOBS.filter((j) => jobs.includes(j)).join(', '),
    }));
}

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
  status: z.string().nullish(),
  production_companies: z.array(companySchema).default([]),
  credits: movieCreditsSchema,
  ...votes,
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
  status: z.string().nullish(),
  networks: z.array(companySchema).default([]),
  production_companies: z.array(companySchema).default([]),
  created_by: z
    .array(
      z.object({
        id: z.number(),
        name: z.string().default(''),
        profile_path: z.string().nullish(),
      }),
    )
    .default([]),
  last_episode_to_air: episodeRefSchema,
  next_episode_to_air: episodeRefSchema,
  aggregate_credits: aggregateCreditsSchema,
  ...votes,
  seasons: z
    .array(
      z.object({
        season_number: z.number(),
        name: z.string().default(''),
        episode_count: z.number().default(0),
        air_date: z.string().nullish(),
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
          voteAverage: r.vote_average ?? null,
          voteCount: r.vote_count ?? 0,
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
          voteAverage: r.vote_average ?? null,
          voteCount: r.vote_count ?? 0,
        }),
      ),
    };
  }

  async movieDetails(tmdbId: number): Promise<ProviderTitleDetails> {
    const d = this.parse(
      movieDetailsSchema,
      await this.get(`/movie/${tmdbId}`, { append_to_response: 'credits' }),
    );
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
      voteAverage: d.vote_average ?? null,
      voteCount: d.vote_count ?? 0,
      status: d.status || null,
      lastEpisodeToAir: null,
      nextEpisodeToAir: null,
      cast: (d.credits?.cast ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .slice(0, CAST_LIMIT)
        .map((c) => ({
          tmdbId: c.id,
          name: c.name,
          role: c.character ?? '',
          profilePath: c.profile_path ?? null,
        })),
      crew: movieCrew(d.credits?.crew ?? []),
      networks: [],
      productionCompanies: d.production_companies.slice(0, COMPANY_LIMIT).map(toCompany),
    };
  }

  async tvDetails(tmdbId: number): Promise<ProviderTitleDetails> {
    const d = this.parse(
      tvDetailsSchema,
      await this.get(`/tv/${tmdbId}`, { append_to_response: 'aggregate_credits' }),
    );
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
          airDate: s.air_date || null,
          isSpecials: s.season_number === 0,
        })),
      voteAverage: d.vote_average ?? null,
      voteCount: d.vote_count ?? 0,
      status: d.status || null,
      lastEpisodeToAir: toEpisodeRef(d.last_episode_to_air),
      nextEpisodeToAir: toEpisodeRef(d.next_episode_to_air),
      cast: (d.aggregate_credits?.cast ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .slice(0, CAST_LIMIT)
        .map((c) => ({
          tmdbId: c.id,
          name: c.name,
          role: c.roles
            .map((r) => r.character)
            .filter(Boolean)
            .join(' / '),
          profilePath: c.profile_path ?? null,
        })),
      crew: d.created_by.map((p) => ({
        tmdbId: p.id,
        name: p.name,
        role: 'Creator',
        profilePath: p.profile_path ?? null,
      })),
      networks: d.networks.map(toCompany),
      productionCompanies: d.production_companies.slice(0, COMPANY_LIMIT).map(toCompany),
    };
  }

  private popular(
    pool: 'movie' | 'tv',
    data: z.infer<typeof searchMovieSchema> | z.infer<typeof searchTvSchema>,
  ) {
    return data.results.map((r): ProviderSearchResult => {
      const movie = r as z.infer<typeof searchMovieSchema>['results'][number];
      const tv = r as z.infer<typeof searchTvSchema>['results'][number];
      return {
        tmdbId: r.id,
        mediaType: pool,
        title: pool === 'movie' ? movie.title : tv.name,
        originalTitle: pool === 'movie' ? movie.original_title : tv.original_name,
        releaseDate: (pool === 'movie' ? movie.release_date : tv.first_air_date) || null,
        posterPath: r.poster_path ?? null,
        overview: r.overview,
        popularity: r.popularity,
        voteAverage: r.vote_average ?? null,
        voteCount: r.vote_count ?? 0,
      };
    });
  }

  async popularMovies(): Promise<ProviderSearchResult[]> {
    return this.popular(
      'movie',
      this.parse(searchMovieSchema, await this.get('/movie/popular', { page: '1' })),
    );
  }

  async popularTv(): Promise<ProviderSearchResult[]> {
    return this.popular(
      'tv',
      this.parse(searchTvSchema, await this.get('/tv/popular', { page: '1' })),
    );
  }

  async trendingAll(window: TrendingWindow): Promise<ProviderSearchResult[]> {
    const data = this.parse(trendingSchema, await this.get(`/trending/all/${window}`, {}));
    return data.results
      .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
      .map((r): ProviderSearchResult => {
        const isMovie = r.media_type === 'movie';
        return {
          tmdbId: r.id,
          mediaType: isMovie ? 'movie' : 'tv',
          title: (isMovie ? r.title : r.name) ?? '',
          originalTitle: (isMovie ? r.original_title : r.original_name) ?? '',
          releaseDate: (isMovie ? r.release_date : r.first_air_date) || null,
          posterPath: r.poster_path ?? null,
          overview: r.overview,
          popularity: r.popularity,
          voteAverage: r.vote_average ?? null,
          voteCount: r.vote_count ?? 0,
        };
      });
  }

  async tvSeason(tmdbId: number, seasonNumber: number): Promise<ProviderSeasonDetails> {
    const d = this.parse(
      seasonDetailsSchema,
      await this.get(`/tv/${tmdbId}/season/${seasonNumber}`, {}),
    );
    return {
      tmdbId,
      seasonNumber: d.season_number,
      name: d.name,
      overview: d.overview,
      airDate: d.air_date || null,
      posterPath: d.poster_path ?? null,
      episodes: d.episodes
        .slice()
        .sort((a, b) => a.episode_number - b.episode_number)
        .map((e) => ({
          episodeNumber: e.episode_number,
          name: e.name,
          overview: e.overview,
          airDate: e.air_date || null,
          runtimeMinutes: e.runtime ?? null,
          stillPath: e.still_path ?? null,
          voteAverage: e.vote_average ?? null,
          voteCount: e.vote_count ?? 0,
        })),
    };
  }
}
