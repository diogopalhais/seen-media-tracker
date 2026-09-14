import {
  type PushConfig,
  type PushSendResult,
  PushSubscriptionRequestSchema,
  PushUnsubscribeRequestSchema,
} from '@seen/shared';
import { Hono, type MiddlewareHandler } from 'hono';
import type { PushRepository, PushService } from '../services/push.js';
import type { AppEnv } from '../types.js';
import { validate } from '../validate.js';

export interface PushDeps {
  service: PushService;
  repo: PushRepository;
  requireAuth: MiddlewareHandler<AppEnv>;
  now: () => Date;
}

export function pushRoutes(deps: PushDeps): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/push/config', deps.requireAuth, (c) => {
    const body: PushConfig = {
      enabled: deps.service.enabled,
      publicKey: deps.service.enabled ? deps.service.publicKey : null,
    };
    return c.json(body, 200);
  });

  router.put(
    '/push/subscriptions',
    deps.requireAuth,
    validate('json', PushSubscriptionRequestSchema),
    async (c) => {
      deps.service.assertEnabled();
      await deps.repo.upsert(c.req.valid('json'), deps.now());
      return c.body(null, 204);
    },
  );

  router.delete(
    '/push/subscriptions',
    deps.requireAuth,
    validate('json', PushUnsubscribeRequestSchema),
    async (c) => {
      deps.service.assertEnabled();
      await deps.repo.remove(c.req.valid('json').endpoint);
      return c.body(null, 204);
    },
  );

  router.post('/push/test', deps.requireAuth, async (c) => {
    deps.service.assertEnabled();
    const body: PushSendResult = await deps.service.broadcast({
      kind: 'test',
      title: 'Seen',
      body: 'Notifications are working on this device.',
      url: '/settings',
      tag: 'test',
    });
    return c.json(body, 200);
  });

  return router;
}
