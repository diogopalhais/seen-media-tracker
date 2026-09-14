import { z } from 'zod';

/** Whether the server can send Web Push, and the VAPID public key clients subscribe with. */
export const PushConfigSchema = z.object({
  enabled: z.boolean(),
  publicKey: z.string().nullable(),
});
export type PushConfig = z.infer<typeof PushConfigSchema>;

/** A browser PushSubscription as sent to the server (the JSON form of `subscription.toJSON()`). */
export const PushSubscriptionRequestSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(400).optional(),
});
export type PushSubscriptionRequest = z.infer<typeof PushSubscriptionRequestSchema>;

export const PushUnsubscribeRequestSchema = z.object({ endpoint: z.url() });
export type PushUnsubscribeRequest = z.infer<typeof PushUnsubscribeRequestSchema>;

/** Payload delivered to the service worker; validated there before anything is shown. */
export const PushNotificationSchema = z.object({
  kind: z.enum(['new_episode', 'test']),
  title: z.string().min(1),
  body: z.string(),
  /** In-app path to open when tapped (e.g. `/library/<id>`). */
  url: z.string().startsWith('/'),
  /** Groups notifications so a series replaces its previous one instead of stacking. */
  tag: z.string().min(1),
});
export type PushNotification = z.infer<typeof PushNotificationSchema>;

export const PushSendResultSchema = z.object({
  sent: z.number().int().min(0),
  failed: z.number().int().min(0),
  /** Subscriptions the push service reported as gone, now deleted. */
  removed: z.number().int().min(0),
});
export type PushSendResult = z.infer<typeof PushSendResultSchema>;

/** Only episodes that aired within this many days are announced; older ones are marked silently. */
export const ANNOUNCE_WINDOW_DAYS = 7;
