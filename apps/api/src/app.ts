import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type { Config } from './config.js';
import type { Db } from './db/client.js';
import { ApiError, sendError } from './errors.js';
import type { Logger } from './logger.js';
import { requireAuth as requireAuthFactory } from './middleware/auth.js';
import { clientIp } from './middleware/client-ip.js';
import { requireJsonBody } from './middleware/content-type.js';
import { rateLimit } from './middleware/rate-limit.js';
import { requestId } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { noStore, securityHeaders } from './middleware/security-headers.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { libraryRoutes } from './routes/library.js';
import { publicRoutes } from './routes/public.js';
import { searchRoutes } from './routes/search.js';
import { watchRoutes } from './routes/watches.js';
import { LibraryRepository } from './services/library.js';
import type { MetadataProvider } from './services/metadata/provider.js';
import { SessionService } from './services/sessions.js';
import { SlidingWindow } from './services/sliding-window.js';
import type { AppEnv } from './types.js';

export const BODY_LIMIT_BYTES = 100 * 1024;
export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const PUBLIC_RATE_LIMIT = 60;
export const PUBLIC_RATE_WINDOW_MS = 60 * 1000;

export interface AppDeps {
  config: Pick<Config, 'OWNER_PASSWORD_HASH' | 'CORS_ORIGINS' | 'TRUST_PROXY'>;
  db: Db;
  provider: MetadataProvider;
  logger: Logger;
  now?: () => Date;
  startedAt?: number;
}

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const now = deps.now ?? (() => new Date());
  const nowMs = () => now().getTime();
  const sessions = new SessionService(deps.db, now);
  const library = new LibraryRepository(deps.db);
  const requireAuth = requireAuthFactory(sessions);
  const loginFailures = new SlidingWindow(LOGIN_FAILURE_LIMIT, LOGIN_FAILURE_WINDOW_MS, nowMs);
  const publicWindow = new SlidingWindow(PUBLIC_RATE_LIMIT, PUBLIC_RATE_WINDOW_MS, nowMs);

  const app = new Hono<AppEnv>();

  app.use(requestId());
  app.use(requestLogger(deps.logger));
  app.use(securityHeaders());
  app.use(clientIp(deps.config.TRUST_PROXY));

  const publicCors = cors({ origin: '*', allowMethods: ['GET', 'HEAD', 'OPTIONS'], maxAge: 600 });
  const privateCors = cors({
    origin: (origin) => (deps.config.CORS_ORIGINS.includes(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposeHeaders: [
      'X-Request-Id',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'Retry-After',
    ],
    maxAge: 600,
  });
  app.use('/api/v1/public/*', publicCors);
  app.use('/api/v1/public/*', rateLimit(publicWindow));
  app.use('/api/v1/*', (c, next) =>
    c.req.path.startsWith('/api/v1/public/') ? next() : privateCors(c, next),
  );
  app.use('/api/v1/*', (c, next) =>
    c.req.path.startsWith('/api/v1/public/') ? next() : noStore()(c, next),
  );
  app.use(
    '/api/v1/*',
    bodyLimit({
      maxSize: BODY_LIMIT_BYTES,
      onError: () => {
        throw new ApiError(
          'payload_too_large',
          `Request body must be at most ${BODY_LIMIT_BYTES} bytes`,
        );
      },
    }),
  );
  app.use('/api/v1/*', requireJsonBody());

  app.route('/health', healthRoutes(deps.db, deps.startedAt ?? Date.now()));
  app.route(
    '/api/v1/auth',
    authRoutes({
      passwordHash: deps.config.OWNER_PASSWORD_HASH,
      sessions,
      loginFailures,
      requireAuth,
    }),
  );
  app.route('/api/v1', searchRoutes({ provider: deps.provider, library, requireAuth }));
  app.route('/api/v1', watchRoutes({ provider: deps.provider, library, requireAuth, now }));
  app.route('/api/v1', libraryRoutes({ library, provider: deps.provider, requireAuth, now }));
  app.route('/api/v1/public', publicRoutes({ library, now }));

  app.notFound((c) => sendError(c, ApiError.notFound('Route')));

  app.onError((err, c) => {
    if (err instanceof ApiError) return sendError(c, err);
    if (err instanceof HTTPException) {
      const code =
        err.status === 413
          ? 'payload_too_large'
          : err.status === 401
            ? 'unauthorized'
            : err.status === 404
              ? 'not_found'
              : err.status === 405
                ? 'method_not_allowed'
                : err.status === 400
                  ? 'validation_error'
                  : 'internal_error';
      return sendError(
        c,
        new ApiError(code, code === 'internal_error' ? 'Unexpected error' : err.message),
      );
    }
    (c.get('logger') ?? deps.logger).error({ err }, 'unhandled error');
    return sendError(c, new ApiError('internal_error', 'Something went wrong'));
  });

  return app;
}
