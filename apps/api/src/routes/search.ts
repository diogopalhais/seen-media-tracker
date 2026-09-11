import {
  SEARCH_PAGE_SIZE,
  SearchQuerySchema,
  type SearchResponse,
  type SearchResult,
  type TitleDetails,
  TitleParamsSchema,
  tmdbBackdropUrl,
  tmdbPosterUrl,
  tmdbTitleUrl,
} from '@seen/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import { ApiError } from '../errors.js';
import { type LibraryRepository, membershipKey } from '../services/library.js';
import {
  detailsFor,
  type MetadataProvider,
  ProviderError,
  type ProviderSearchPage,
  type ProviderSearchResult,
  releaseYear,
} from '../services/metadata/provider.js';
import type { AppEnv } from '../types.js';
import { validate } from '../validate.js';

export interface SearchDeps {
  provider: MetadataProvider;
  library: LibraryRepository;
  requireAuth: MiddlewareHandler<AppEnv>;
}

export function mapProviderError(err: unknown): never {
  if (err instanceof ProviderError) {
    if (err.kind === 'not_found') throw ApiError.notFound('Title');
    throw new ApiError('upstream_unavailable', 'The metadata provider is currently unavailable');
  }
  throw err;
}

const byPopularity = (a: ProviderSearchResult, b: ProviderSearchResult) =>
  b.popularity - a.popularity;

/**
 * For `all`, each TMDB page of movies+tv (up to 40 results) is served as two API pages of 20,
 * so nothing is lost when merging the two upstream lists.
 */
async function combinedPage(provider: MetadataProvider, q: string, page: number) {
  const upstreamPage = Math.ceil(page / 2);
  const [movies, tv] = await Promise.all([
    provider.searchMovies(q, upstreamPage),
    provider.searchTv(q, upstreamPage),
  ]);
  const merged = [...movies.results, ...tv.results].sort(byPopularity);
  const firstHalf = page % 2 === 1;
  const slice = firstHalf
    ? merged.slice(0, SEARCH_PAGE_SIZE)
    : merged.slice(SEARCH_PAGE_SIZE, SEARCH_PAGE_SIZE * 2);
  const upstreamHasMore = movies.totalPages > upstreamPage || tv.totalPages > upstreamPage;
  const hasMore = firstHalf ? merged.length > SEARCH_PAGE_SIZE || upstreamHasMore : upstreamHasMore;
  return { results: slice, hasMore };
}

function singlePage(pageData: ProviderSearchPage) {
  return {
    results: pageData.results.slice().sort(byPopularity).slice(0, SEARCH_PAGE_SIZE),
    hasMore: pageData.totalPages > pageData.page,
  };
}

export function searchRoutes(deps: SearchDeps): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/search', deps.requireAuth, validate('query', SearchQuerySchema), async (c) => {
    const { q, type, page } = c.req.valid('query');
    let data: { results: ProviderSearchResult[]; hasMore: boolean };
    try {
      data =
        type === 'all'
          ? await combinedPage(deps.provider, q, page)
          : singlePage(
              await (type === 'movie'
                ? deps.provider.searchMovies(q, page)
                : deps.provider.searchTv(q, page)),
            );
    } catch (err) {
      mapProviderError(err);
    }
    const membership = await deps.library.membership(data.results);
    const results: SearchResult[] = data.results.map((r) => {
      const itemId = membership.get(membershipKey(r.mediaType, r.tmdbId)) ?? null;
      return {
        tmdbId: r.tmdbId,
        mediaType: r.mediaType,
        title: r.title,
        originalTitle: r.originalTitle,
        releaseYear: releaseYear(r.releaseDate),
        posterUrl: tmdbPosterUrl(r.posterPath),
        overview: r.overview,
        popularity: r.popularity,
        inLibrary: itemId !== null,
        libraryItemId: itemId,
      };
    });
    const body: SearchResponse = { results, page, hasMore: data.hasMore };
    return c.json(body, 200);
  });

  router.get(
    '/titles/:mediaType/:tmdbId',
    deps.requireAuth,
    validate('param', TitleParamsSchema),
    async (c) => {
      const { mediaType, tmdbId } = c.req.valid('param');
      let details: Awaited<ReturnType<typeof detailsFor>>;
      try {
        details = await detailsFor(deps.provider, mediaType, tmdbId);
      } catch (err) {
        mapProviderError(err);
      }
      const membership = await deps.library.membershipFor(mediaType, tmdbId);
      const body: TitleDetails = {
        mediaType,
        tmdbId,
        title: details.title,
        originalTitle: details.originalTitle,
        releaseYear: releaseYear(details.releaseDate),
        releaseDate: details.releaseDate,
        overview: details.overview,
        posterUrl: tmdbPosterUrl(details.posterPath),
        backdropUrl: tmdbBackdropUrl(details.backdropPath),
        genres: details.genres,
        runtimeMinutes: details.runtimeMinutes,
        numberOfSeasons: details.numberOfSeasons,
        seasons: details.seasons,
        tmdbUrl: tmdbTitleUrl(mediaType, tmdbId),
        rating: membership.rating,
        inLibrary: membership.inLibrary,
        libraryItemId: membership.libraryItemId,
      };
      return c.json(body, 200);
    },
  );

  return router;
}
