import type { PushNotification, PushSendResult, PushSubscriptionRequest } from '@seen/shared';
import { eq } from 'drizzle-orm';
import webPush from 'web-push';
import type { VapidConfig } from '../config.js';
import type { Db } from '../db/client.js';
import { type PushSubscriptionRow, pushSubscriptions } from '../db/schema.js';
import { ApiError } from '../errors.js';
import type { Logger } from '../logger.js';

export type PushOutcome = 'ok' | 'gone' | 'failed';

/** Delivers one encrypted payload to one device. Abstracted so tests never touch a push service. */
export interface Pusher {
  send(
    subscription: Pick<PushSubscriptionRow, 'endpoint' | 'p256dh' | 'auth'>,
    payload: string,
  ): Promise<PushOutcome>;
}

const PUSH_TTL_SECONDS = 24 * 60 * 60;

export class WebPushPusher implements Pusher {
  constructor(vapid: VapidConfig) {
    webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  }

  async send(
    sub: Pick<PushSubscriptionRow, 'endpoint' | 'p256dh' | 'auth'>,
    payload: string,
  ): Promise<PushOutcome> {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: PUSH_TTL_SECONDS, urgency: 'normal' },
      );
      return 'ok';
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410: the device unsubscribed or the endpoint expired. Anything else is transient.
      return status === 404 || status === 410 ? 'gone' : 'failed';
    }
  }
}

export class PushRepository {
  constructor(private readonly db: Db) {}

  async upsert(input: PushSubscriptionRequest, now: Date): Promise<void> {
    await this.db
      .insert(pushSubscriptions)
      .values({
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
        createdAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent ?? null,
          lastSeenAt: now,
        },
      });
  }

  async remove(endpoint: string): Promise<void> {
    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  all(): Promise<PushSubscriptionRow[]> {
    return this.db.select().from(pushSubscriptions);
  }
}

/** Sends a notification to every registered device and prunes the ones that are gone. */
export class PushService {
  constructor(
    private readonly repo: PushRepository,
    private readonly pusher: Pusher | null,
    readonly publicKey: string | null,
    private readonly logger: Logger,
  ) {}

  get enabled(): boolean {
    return this.pusher !== null && this.publicKey !== null;
  }

  assertEnabled(): void {
    if (!this.enabled)
      throw new ApiError('push_disabled', 'Push notifications are not configured on this server');
  }

  async broadcast(notification: PushNotification): Promise<PushSendResult> {
    const result: PushSendResult = { sent: 0, failed: 0, removed: 0 };
    if (!this.pusher) return result;
    const payload = JSON.stringify(notification);
    const subs = await this.repo.all();
    await Promise.all(
      subs.map(async (sub) => {
        const outcome = await (this.pusher as Pusher).send(sub, payload);
        if (outcome === 'ok') result.sent++;
        else if (outcome === 'gone') {
          result.removed++;
          await this.repo.remove(sub.endpoint);
        } else {
          result.failed++;
          this.logger.warn({ endpoint: sub.endpoint.slice(0, 60) }, 'push delivery failed');
        }
      }),
    );
    return result;
  }
}
