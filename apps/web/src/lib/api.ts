import {
  type ApiErrorBody,
  type ApiErrorCode,
  type ApiErrorDetail,
  ApiErrorSchema,
  type DiscoverResponse,
  DiscoverResponseSchema,
  type EpisodeWatchesResponse,
  EpisodeWatchesResponseSchema,
  type LibraryItemDetail,
  LibraryItemDetailSchema,
  type LibraryListResponse,
  LibraryListResponseSchema,
  type LibrarySort,
  type LoginResponse,
  LoginResponseSchema,
  type LogWatchRequest,
  type MediaType,
  type MediaTypeFilter,
  type SearchResponse,
  SearchResponseSchema,
  type SeasonDetails,
  SeasonDetailsSchema,
  type SessionResponse,
  SessionResponseSchema,
  type SetEpisodesWatchedRequest,
  type TitleDetails,
  TitleDetailsSchema,
  type UpdateWatchRequest,
  type WatchMutationResponse,
  WatchMutationResponseSchema,
} from '@seen/shared';
import type { z } from 'zod';
import { tokenStore } from './token-store.js';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'network_error' | 'offline' | 'bad_response',
    message: string,
    readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages keyed by path, for inline form errors. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details) if (!(d.path in out)) out[d.path] = d.message;
    return out;
  }

  /** True only when the browser reports no connectivity; other fetch failures are server or network faults. */
  get isOffline(): boolean {
    return this.code === 'offline';
  }

  get isNetworkFailure(): boolean {
    return this.code === 'offline' || this.code === 'network_error';
  }
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  schema?: z.ZodType<T>;
  auth?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions<T> = {}): Promise<T> {
  const { method = 'GET', body, schema, auth = true, signal } = opts;
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (auth) {
    const token = tokenStore.get();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new ApiError(
      0,
      offline ? 'offline' : 'network_error',
      offline ? "You're offline" : 'Could not reach the server',
    );
  }

  if (res.status === 401 && auth) {
    tokenStore.clear('expired');
  }

  if (!res.ok) {
    let parsed: ApiErrorBody | null = null;
    try {
      parsed = ApiErrorSchema.parse(await res.json());
    } catch {
      parsed = null;
    }
    throw new ApiError(
      res.status,
      parsed?.error.code ?? 'internal_error',
      parsed?.error.message ?? `Request failed (${res.status})`,
      parsed?.error.details ?? [],
    );
  }

  if (res.status === 204) return undefined as T;
  const json: unknown = await res.json();
  if (!schema) return json as T;
  const result = schema.safeParse(json);
  if (!result.success)
    throw new ApiError(res.status, 'bad_response', 'Unexpected response from the server');
  return result.data;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '') search.set(k, String(v));
  const s = search.toString();
  return s ? `?${s}` : '';
};

export const api = {
  login: (password: string) =>
    request<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: { password },
      schema: LoginResponseSchema,
      auth: false,
    }),
  logout: () => request<void>('/api/v1/auth/logout', { method: 'POST' }),
  session: () =>
    request<SessionResponse>('/api/v1/auth/session', { schema: SessionResponseSchema }),

  search: (q: string, type: MediaTypeFilter, page = 1, signal?: AbortSignal) =>
    request<SearchResponse>(`/api/v1/search${qs({ q, type, page })}`, {
      schema: SearchResponseSchema,
      ...(signal ? { signal } : {}),
    }),
  discover: () => request<DiscoverResponse>('/api/v1/discover', { schema: DiscoverResponseSchema }),
  season: (tmdbId: number, seasonNumber: number) =>
    request<SeasonDetails>(`/api/v1/titles/tv/${tmdbId}/seasons/${seasonNumber}`, {
      schema: SeasonDetailsSchema,
    }),
  title: (mediaType: MediaType, tmdbId: number) =>
    request<TitleDetails>(`/api/v1/titles/${mediaType}/${tmdbId}`, { schema: TitleDetailsSchema }),

  library: (query: {
    type?: MediaTypeFilter;
    sort?: LibrarySort;
    cursor?: string;
    limit?: number;
  }) =>
    request<LibraryListResponse>(
      `/api/v1/library${qs({ type: query.type, sort: query.sort, cursor: query.cursor, limit: query.limit })}`,
      {
        schema: LibraryListResponseSchema,
      },
    ),
  libraryItem: (id: string) =>
    request<LibraryItemDetail>(`/api/v1/library/${id}`, { schema: LibraryItemDetailSchema }),

  logWatch: (body: LogWatchRequest) =>
    request<WatchMutationResponse>('/api/v1/watches', {
      method: 'POST',
      body,
      schema: WatchMutationResponseSchema,
    }),
  updateWatch: (id: string, body: UpdateWatchRequest) =>
    request<WatchMutationResponse>(`/api/v1/watches/${id}`, {
      method: 'PATCH',
      body,
      schema: WatchMutationResponseSchema,
    }),
  deleteWatch: (id: string) => request<void>(`/api/v1/watches/${id}`, { method: 'DELETE' }),
  setEpisodesWatched: (body: SetEpisodesWatchedRequest) =>
    request<EpisodeWatchesResponse>('/api/v1/watches/episodes', {
      method: 'PUT',
      body,
      schema: EpisodeWatchesResponseSchema,
    }),
};
