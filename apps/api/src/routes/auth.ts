import { verify } from '@node-rs/argon2';
import { LoginRequestSchema, type LoginResponse, type SessionResponse } from '@seen/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import { ApiError } from '../errors.js';
import { rateLimitedError } from '../middleware/rate-limit.js';
import type { SessionService } from '../services/sessions.js';
import type { SlidingWindow } from '../services/sliding-window.js';
import type { AppEnv } from '../types.js';
import { validate } from '../validate.js';

export interface AuthDeps {
  passwordHash: string;
  sessions: SessionService;
  loginFailures: SlidingWindow;
  requireAuth: MiddlewareHandler<AppEnv>;
}

export function authRoutes(deps: AuthDeps): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post('/login', validate('json', LoginRequestSchema), async (c) => {
    const ip = c.get('clientIp');
    if (deps.loginFailures.isLimited(ip)) throw rateLimitedError(deps.loginFailures, ip);

    const { password } = c.req.valid('json');
    let ok = false;
    try {
      ok = await verify(deps.passwordHash, password);
    } catch {
      ok = false;
    }
    if (!ok) {
      deps.loginFailures.hit(ip);
      throw new ApiError('invalid_credentials', 'Incorrect password');
    }
    deps.loginFailures.reset(ip);
    const { token, expiresAt } = await deps.sessions.create(c.req.header('user-agent') ?? null);
    const body: LoginResponse = { token, expiresAt: expiresAt.toISOString() };
    return c.json(body, 200);
  });

  router.post('/logout', deps.requireAuth, async (c) => {
    await deps.sessions.revoke(c.get('session').id);
    return c.body(null, 204);
  });

  router.get('/session', deps.requireAuth, (c) => {
    const body: SessionResponse = {
      authenticated: true,
      expiresAt: c.get('session').expiresAt.toISOString(),
    };
    return c.json(body, 200);
  });

  return router;
}
